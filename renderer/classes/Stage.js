const {Fragment} = require('./Fragment');
const {Scaler} = require('./Scaler');

/**
 * TODO
 */
class Stage {
  /**
     * TODO
     * @param {*} controller
     * @param {*} DOMelement
     * @param {*} width
     * @param {*} height
     */
  constructor(controller, DOMelement, width, height) {
    // create new stage and set to given DOMelement
    this.controller = controller;
    this.stage = new createjs.Stage(DOMelement);
    this.stage.canvas.width = this.width = width;
    this.stage.canvas.height = this.height = height;
    this.stage.enableMouseOver();
    createjs.Touch.enable(this.stage);

    this.fragmentList = {};
    this.selectedList = {};
    this.fragmentLabel = 0;

    this.stage.offset = {x: 0, y: 0};
    this.stage.scaling = 100;

    this.lines = {
      'horizontal': null,
      'vertical': null,
    };

    this.background = this._createBackground(width, height);
    this.stage.addChild(this.background);

    // selection box
    this.selector = new Selector(this.controller);

    // LoadQueue object for the images
    this.loadqueue = new createjs.LoadQueue();
    this.loadqueue.addEventListener('fileload', (event) => {
      this._createFragment(event);
    });
  }

  /**
   * TODO
   * @param {*} width
   * @param {*} height
   * @return {*}
   */
  _createBackground(width, height) {
    // create (almost) invisible background element to
    // allow for mouse interaction; pixels have to be barely
    // visible
    const background = new createjs.Shape();
    background.graphics.beginFill('#333333')
        .drawRect(0, 0, width, height);
    background.alpha = 0.01;
    background.name = 'background';
    background.on('mousedown', (event) => {
      this.controller.clearSelection();
      this.mouseClickStart = {x: event.stageX, y: event.stageY};
    });
    background.on('pressmove', (event) => {
      this._panScene(event);
    });
    background.on('pressup', (event) => {
      this._saveToModel();
    });

    return background;
  }

  /**
   * TODO
   */
  _clearTable() {
    for (const idx in this.fragmentList) {
      if (Object.prototype.hasOwnProperty.call(this.fragmentList, idx)) {
        this.stage.removeChild(this.fragmentList[idx].getContainer());
      }
    }

    this.clearSelection();
    this._clearFragmentList();
    this.update();
  }

  /**
   * TODO
   * @param {*} data
   */
  loadScene(data) {
    this._clearTable();

    if (data && data.stage) {
      this._loadStageConfiguration(data.stage);
    } else {
      this._loadStageConfiguration();
    }

    if (data && data.fragments) {
      this._loadFragments(data.fragments);
    }

    this.update();
  }

  /**
   * TODO
   * @param {*} settings
   */
  _loadStageConfiguration(settings) {
    if (settings && settings.offset ? this.stage.offset = settings.offset :
        this.stage.offset = {x: 0, y: 0});
    // if (this.stage.scaling ? this.stage.scaling = settings.scaling :
    //      this.stage.scaling = 100);
  }

  /**
   * TODO
   * @return {*}
   */
  getData() {
    return {
      'offset': this.stage.offset,
      'scaling': this.stage.scaling,
    };
  }

  /**
   * TODO
   * @return {*}
   */
  getConfiguration() {
    const stageData = this.getData();
    const itemsData = {};
    for (const idx in this.fragmentList) {
      if (Object.prototype.hasOwnProperty.call(this.fragmentList, idx)) {
        itemsData[idx] = this.fragmentList[idx].getData();
      }
    }

    return {
      'stage': stageData,
      'fragments': itemsData,
    };
  }

  /**
   * TODO
   * @return {*}
   */
  getFragmentList() {
    return this.fragmentList;
  }

  /**
   * TODO
   * @return {*}
   */
  getSelectedList() {
    return this.selectedList;
  }

  /**
   * TODO
   * @return {*}
   */
  getCenter() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    return {'x': cx, 'y': cy};
  }

  /**
   * TODO
   */
  _saveToModel() {
    const dataObject = this.getConfiguration();
    ipcRenderer.send('server-save-to-model', dataObject);
  }

  /**
   * TODO
   * @param {*} scaling
   */
  setScaling(scaling) {
    // scaling should only impact the scene if between values 10 and 300
    // i.e. scaling by 0.1 min or 3.0 max
    if (scaling >= 10 && scaling <= 300) {
      this.stage.old_scaling = this.stage.scaling;
      this.stage.scaling = scaling;
      Scaler.scaling = scaling/100;

      this.stage.offset.x = this.stage.offset.x * scaling /
            this.stage.old_scaling;
      this.stage.offset.y = this.stage.offset.y * scaling /
            this.stage.old_scaling;

      // scaling via zoom slider
      Scaler.zoom.screen.x = Math.floor(this.stage.canvas.width / 2);
      Scaler.zoom.screen.y = Math.floor(this.stage.canvas.height / 2);
      Scaler.zoom.world.x = Scaler.x_INV(Scaler.zoom.screen.x);
      Scaler.zoom.world.y = Scaler.y_INV(Scaler.zoom.screen.y);

      this._scaleObjects();
      this.update();
    }
  }

  /**
   * TODO
   * @param {*} width
   * @param {*} height
   */
  resizeCanvas(width, height) {
    this.stage.canvas.width = this.width = width;
    this.stage.canvas.height = this.height = height;

    this.stage.removeChild(this.background);
    this.background = this._createBackground(width, height);
    this.stage.addChildAt(this.background, 0);

    this.update();
  }

  /**
   * TODO
   */
  update() {
    this.stage.update();
  }

  /**
   * TODO
   */
  _updateUIElements() {
    this._updateBb();
    this._updateRotator();
    this._updateFlipper();
  }

  /**
   * TODO
   * @param {*} imageList
   */
  _loadFragments(imageList) {
    for (const id in imageList) {
      if (Object.prototype.hasOwnProperty.call(imageList, id)) {
        let url = imageList[id].rectoURL;
        if (!imageList[id].recto) {
          url = imageList[id].versoURL;
        }
        this.loadqueue.loadManifest([{id: id, src: url,
          properties: imageList[id]}], false);
      }
    }
    // TODO: necessary to check that image can only be added once?
    this.loadqueue.load();
  }

  /**
   * TODO
   * @param {*} event
   */
  _createFragment(event) {
    let newId;
    if (event.item.id && event.item.id != 'upload') {
      newId = event.item.id;
    } else {
      newId = this.getNewFragmentId();
    }
    const newFragment = new Fragment(this.controller, this, newId, event);
    this.fragmentList[newId] = newFragment;
    const fragmentContainer = newFragment.getContainer();
    const fragmentImage = newFragment.getImage();
    this.stage.addChild(fragmentContainer);

    this.registerImageEvents(fragmentImage);

    this.controller.updateFragmentList();
    this.stage.update();
  }

  /**
   * TODO
   * @param {*} id
   */
  removeFragment(id) {
    // iterate over fragmentList and match items with requested id
    for (const idx in this.fragmentList) {
      if (Object.prototype.hasOwnProperty.call(this.fragmentList, idx)) {
        const fragment = this.fragmentList[idx];
        if (fragment.id == id) {
          // remove correct fragment both from stage and fragmentList
          const fragmentContainer = fragment.getContainer();
          this.stage.removeChild(fragmentContainer);
          delete this.fragmentList[fragment.id];
          this.stage.update();
        }
      }
    }
  }

  /**
   * TODO
   */
  deleteSelectedFragments() {
    for (const id in this.selectedList) {
      if (Object.prototype.hasOwnProperty.call(this.selectedList, id)) {
        this.removeFragment(id);
      }
    }
    this.controller.clearSelection();
  }

  /**
   * TODO
   * @param {*} image
   */
  registerImageEvents(image) {
    image.on('mousedown', (event) => {
      const clickedId = event.target.id;
      if (event.nativeEvent.ctrlKey == false && !this._isSelected(clickedId)) {
        // if ctrl key is not pressed, old selection will be cleared
        this.controller.clearSelection();
      }
      if (event.nativeEvent.ctrlKey == true && this._isSelected(clickedId)) {
        // if ctrl key is pressed AND object is already selected:
        // -> remove selection for this object
        this.controller.deselectFragment(clickedId);
      } else {
        // in all other cases, add object to selection
        this.controller.selectFragment(clickedId);
      }
      this._moveToTop(this.fragmentList[clickedId]);

      this._updateBb();
      this.mouseClickStart = {x: event.stageX, y: event.stageY};
    });

    image.on('pressmove', (event) => {
      this._moveObjects(event);
    });

    image.on('pressup', (event) => {
      this._saveToModel();
    });

    image.on('mouseover', (event) => {
      const id = event.target.id;
      this.controller.highlightFragment(id);
    });

    image.on('mouseout', (event) => {
      const id = event.target.id;
      this.controller.unhighlightFragment(id);
    });
  }

  /**
   * TODO
   * @param {*} id
   * @return {*}
   */
  _isSelected(id) {
    return this.selectedList[id];
  }

  /**
   * TODO
   * @param {*} id
   */
  selectFragment(id) {
    this.selectedList[id] = this.fragmentList[id];
    this.fragmentList[id].getImage().shadow = new createjs.Shadow(
        '#f15b40', 0, 0, 10);
    this._updateBb();
  }

  /**
   * TODO
   * @param {*} id
   */
  deselectFragment(id) {
    delete this.selectedList[id];
    this.fragmentList[id].getImage().shadow = null;
    this._updateBb();
  }

  /**
   * TODO
   */
  clearSelection() {
    for (const id in this.selectedList) {
      if (Object.prototype.hasOwnProperty.call(this.selectedList, id)) {
        this.selectedList[id].getImage().shadow = null;
      }
    }
    this.selectedList = {};
    this._updateBb();
  }

  /**
   * TODO
   * @param {*} id
   */
  highlightFragment(id) {
    this.fragmentList[id].getImage().shadow = new createjs.Shadow(
        '#A4042A', 0, 0, 10);
    this.update();
  }

  /**
   * TODO
   * @param {*} id
   */
  unhighlightFragment(id) {
    if (id in this.selectedList) {
      this.fragmentList[id].getImage().shadow = new createjs.Shadow(
          '#f15b40', 0, 0, 10);
    } else {
      this.fragmentList[id].getImage().shadow = null;
    }
    this.update();
  }

  /**
 * TODO
 */
  _clearFragmentList() {
    this.fragmentList = {};
  }

  /**
   * TODO
   * @param {*} event
   */
  _panScene(event) {
    const currentMouseX = event.stageX;
    const currentMouseY = event.stageY;

    const deltaX = currentMouseX - this.mouseClickStart.x;
    const deltaY = currentMouseY - this.mouseClickStart.y;

    this.mouseClickStart = {x: currentMouseX, y: currentMouseY};

    this.moveStage(deltaX, deltaY);
  }

  /**
   * TODO
   * @param {*} fragment
   */
  _moveToTop(fragment) {
    const container = fragment.getContainer();
    this.stage.removeChild(container);
    this.stage.addChild(container);
  }

  /**
   * TODO
   * @param {*} event
   */
  _rotateObjects(event) {
    const radsOld = Math.atan2(this.mouseClickStart.y - this.rotator.y,
        this.mouseClickStart.x - this.rotator.x);
    const radsNew = Math.atan2(event.stageY - this.rotator.y,
        event.stageX - this.rotator.x);
    const rads = radsNew - radsOld;
    const deltaAngle = rads * (180 / Math.PI);

    for (const idx in this.selectedList) {
      if (Object.prototype.hasOwnProperty.call(this.selectedList, idx)) {
        const fragment = this.selectedList[idx];
        fragment.rotateByAngle(deltaAngle);
      }
    }

    this.bb.rotation += deltaAngle;
    this.flipper.rotation += deltaAngle;
    this.rotator.rotation += deltaAngle;

    this.mouseClickStart = {x: event.stageX, y: event.stageY};

    this.update();
  }

  /**
   * TODO
   * @param {*} event
   */
  _moveObjects(event) {
    let movedObject = event.target;

    if (movedObject.name == 'Image') {
      movedObject = movedObject.parent;
    }

    const currentMouseX = event.stageX;
    const currentMouseY = event.stageY;

    const deltaX = currentMouseX - this.mouseClickStart.x;
    const deltaY = currentMouseY - this.mouseClickStart.y;

    this.mouseClickStart = {x: currentMouseX, y: currentMouseY};

    for (const idx in this.selectedList) {
      if (Object.prototype.hasOwnProperty.call(this.selectedList, idx)) {
        const fragment = this.selectedList[idx];
        fragment.moveByDistance(deltaX, deltaY);
      }
    }

    this._updateBb();
    this.update();
  }

  /**
   * TODO
   * @param {*} deltaX
   * @param {*} deltaY
   */
  moveStage(deltaX, deltaY) {
    for (const idx in this.fragmentList) {
      if (Object.prototype.hasOwnProperty.call(this.fragmentList, idx)) {
        const fragment = this.fragmentList[idx];
        fragment.moveByDistance(deltaX, deltaY);
      }
    }

    this.stage.offset.x += deltaX;
    this.stage.offset.y += deltaY;
    this._updateBb();

    this.stage.update();
  }

  /**
   * TODO
   */
  _scaleObjects() {
    for (const idx in this.fragmentList) {
      if (Object.prototype.hasOwnProperty.call(this.fragmentList, idx)) {
        const fragment = this.fragmentList[idx];
        const xNew = Scaler.x(fragment.getX());
        const yNew = Scaler.y(fragment.getY());
        fragment.moveToPixel(xNew, yNew);
        fragment.scaleToValue(this.stage.scaling/100);
      }
    }

    this._updateBb();
    this._updateRotator();
    this.update();
  }

  /**
   * TODO
   * @param {*} horizontalFlip
   */
  flipTable(horizontalFlip=true) {
    this.controller.clearSelection();

    const yAxis = this.stage.canvas.width/2;
    const xAxis = this.stage.canvas.height/2;

    for (const idx in this.fragmentList) {
      if (Object.prototype.hasOwnProperty.call(this.fragmentList, idx)) {
        const fragment = this.fragmentList[idx];
        fragment.flip();

        const x = fragment.getX();
        const y = fragment.getY();

        let xNew; let ynew;
        fragment.rotateToAngle(-fragment.getRotation());
        if (horizontalFlip) {
          xNew = 2*yAxis - x;
          ynew = y;
        } else {
          xNew = x;
          ynew = 2*xAxis - y;
          fragment.rotateToAngle(180+fragment.getRotation());
        }
        fragment.moveToPixel(xNew, ynew);
      }
    }
    this._saveToModel();
    this.controller.updateFragmentList();
  }

  /**
   * TODO
   */
  _updateBb() {
    this.stage.removeChild(this.bb);
    this.selector.updateBb(this.selectedList);
    this.bb = this.selector.getBb();
    this.stage.addChild(this.bb);
    this._updateFlipper(this.bb.center.x, this.bb.center.y,
        this.bb.width, this.bb.height);
    this._updateRotator(this.bb.center.x, this.bb.center.y, this.bb.height);
    this.update();
  }

  /**
   * TODO
   * @param {*} x
   * @param {*} y
   * @param {*} width
   * @param {*} height
   */
  _updateFlipper(x, y, width, height) {
    this.stage.removeChild(this.flipper);

    if (Object.keys(this.selectedList).length == 1) {
      this.flipper = new createjs.Container();

      const circle = new createjs.Shape();
      circle.graphics
          .beginFill('white').drawCircle(0, 0, 20);
      this.flipper.addChild(circle);

      const bmp = new createjs.Bitmap('../imgs/symbol_flip.png');
      bmp.scale = 1;
      bmp.x = bmp.y = -15;
      bmp.onload = function() {
        this.update();
      };
      this.flipper.addChild(bmp);

      this.flipper.x = x;
      this.flipper.y = y;
      this.flipper.regX = -width/2-30;
      this.flipper.regY = -height/2+30;
      this.flipper.name = 'Flip Button';

      if (this.flipper.x - this.flipper.regX > this.stage.canvas.width) {
        this.flipper.regX *= -1;
      }

      this.flipper.on('click', (event) => {
        // the flip button is only accessible if only
        // one element is selected
        // TODO: oder doch für mehrere auch?
        const id = Object.keys(this.selectedList)[0];
        const fragment = this.selectedList[id];
        fragment.flip();
        this._saveToModel();
      });

      this.stage.addChild(this.flipper);
    }
  }

  /**
   * TODO
   * @param {*} x
   * @param {*} y
   * @param {*} height
   */
  _updateRotator(x, y, height) {
    this.stage.removeChild(this.rotator);

    if (Object.keys(this.selectedList).length == 1) {
      this.rotator = new createjs.Container();

      const circle = new createjs.Shape();
      circle.graphics
          .beginFill('#f5842c').drawCircle(0, 0, 20);
      this.rotator.addChild(circle);

      const bmp = new createjs.Bitmap('../imgs/symbol_rotate.png');
      bmp.scale = 1;
      bmp.x = bmp.y = -15;
      this.rotator.addChild(bmp);

      this.rotator.x = x;
      this.rotator.y = y;
      this.rotator.regX = 0;
      this.rotator.regY = height/2;
      if (this.rotator.y - this.rotator.regY < 0) {
        this.rotator.regY *= -1;
      }
      this.rotator.name = 'Rotation Anchor';

      this.stage.addChild(this.rotator);

      this.rotator.on('mousedown', (event) => {
        this.mouseClickStart = {x: event.stageX, y: event.stageY};
      });
      this.rotator.on('pressmove', (event) => {
        this._rotateObjects(event);
      });
      this.rotator.on('pressup', (event) => {
        this._saveToModel();
      });
    }
  }

  /**
   * TODO
   * @param {*} fileFormat "png", "jpg", "jpeg"
   */
  exportCanvas(fileFormat='png') {
    // TODO Vorher muss der canvas noch so skaliert werden,
    // dass alle Inhalte angezeigt werden können

    // remove UI elements
    this.clearSelection();
    this._updateUIElements();

    const pseudoLink = document.createElement('a');
    let extension; let type;

    if (fileFormat == 'jpg' || fileFormat == 'jpeg') {
      extension = 'jpg';
      type = 'image/jpeg';
      const backgroundColor = '#FF00FF';

      // creating a pseudo canvas, filling it with background color
      // then, drawing VLT canvas on top
      const pseudoCanvas = document.createElement('canvas');
      pseudoCanvas.width = this.stage.canvas.width;
      pseudoCanvas.height = this.stage.canvas.height;
      const pseudoContext = pseudoCanvas.getContext('2d');
      pseudoContext.fillStyle = backgroundColor;
      pseudoContext.fillRect(0, 0, this.stage.canvas.width,
          this.stage.canvas.height);
      pseudoContext.drawImage(this.stage.canvas, 0, 0);
      pseudoLink.href = pseudoCanvas.toDataURL();
    } else if (fileFormat == 'png') {
      extension = 'png';
      type = 'image/png';
      pseudoLink.href = document.getElementById('lighttable').toDataURL(type);
    }

    // creating artificial anchor element for download
    pseudoLink.download = 'reconstruction.' + extension;
    pseudoLink.style.display = 'none';

    // temporarily appending the anchor, "clicking" on it, and removing it again
    document.body.appendChild(pseudoLink);
    pseudoLink.click();
    document.body.removeChild(pseudoLink);
  }

  /**
   * TODO
   * @return {*}
   */
  getNewFragmentId() {
    let newId = 'f_' + this.fragmentLabel;
    this.fragmentLabel = this.fragmentLabel + 1;
    if (newId in this.fragmentList) {
      newId = this.getNewFragmentId();
    }
    return newId;
  }

  /**
   * TODO
   * @param {*} horizontal
   */
  showFlipLine(horizontal) {
    if (horizontal) {
      const line = new createjs.Shape();
      line.graphics.setStrokeStyle(4)
          .beginStroke('rgba(0,0,0,0.2)')
          .setStrokeDash([10, 8])
          .moveTo(this.width/2, 0)
          .lineTo(this.width/2, this.height)
          .endStroke();
      this.lines.horizontal = line;
      this.stage.addChild(this.lines.horizontal);
      this.update();
    } else {
      const line = new createjs.Shape();
      line.graphics.setStrokeStyle(4)
          .beginStroke('rgba(0,0,0,0.2)')
          .setStrokeDash([10, 8])
          .moveTo(0, this.height/2)
          .lineTo(this.width, this.height/2)
          .endStroke();
      this.lines.vertical = line;
      this.stage.addChild(this.lines.vertical);
      this.update();
    }
  }

  /**
   * TODO
   */
  hideFlipLines() {
    if (this.lines.horizontal != null) {
      this.stage.removeChild(this.lines.horizontal);
      this.lines.horizontal = null;
    }
    if (this.lines.vertical != null) {
      this.stage.removeChild(this.lines.vertical);
      this.lines.vertical = null;
    }
    this.update();
  }
}

/**
 * TODO
 */
class Selector {
  /**
     * TODO
     * @param {*} controller
     */
  constructor(controller) {
    this.controller = controller;
    this.x = 0;
    this.y = 0;
    this.width = 100;
    this.height = 100;
  }

  /**
   * TODO
   * @param {*} selectionList
   */
  updateBb(selectionList) {
    let left; let top; let right; let bottom;
    for (const idx in selectionList) {
      if (Object.prototype.hasOwnProperty.call(selectionList, idx)) {
        const fragment = selectionList[idx];
        const container = fragment.getContainer();
        // let image = fragment.getImage().image;

        const bounds = container.getTransformedBounds();
        const xLeft = bounds.x;
        const yTop = bounds.y;
        const xRight = bounds.x + bounds.width;
        const yBottom = bounds.y + bounds.height;

        (!left ? left = xLeft : left = Math.min(left, xLeft));
        (!top ? top = yTop : top = Math.min(top, yTop));
        (!right ? right = xRight : right = Math.max(right, xRight));
        (!bottom ? bottom = yBottom : bottom = Math.max(bottom, yBottom));
      }
    }

    this.x = left;
    this.y = top;
    this.width = right-left;
    this.height = bottom-top;
  }

  /**
   * TODO
   * @return {*}
   */
  getBb() {
    const bb = new createjs.Shape();
    bb.name = 'Bounding Box';
    bb.graphics
        .beginStroke('#f5842c')
    // .setStrokeDash([15.5])
    // .setStrokeStyle(2)
        .drawRect(0, 0, this.width, this.height);
    bb.center = {x: this.x + this.width/2, y: this.y + this.height/2};
    bb.x = bb.center.x;
    bb.y = bb.center.y;
    bb.regX = this.width/2;
    bb.regY = this.height/2;
    bb.height = this.height;
    bb.width = this.width;
    return bb;
  }
}

module.exports.Stage = Stage;
