'use strict';

const {ipcRenderer} = require('electron');
const Dialogs = require('dialogs');
const dialogs = new Dialogs();

const recto = {
  'name': 'recto',
  'stage': null,
  'cropbox': new createjs.Shape(),
  'crop_nw': new createjs.Shape(),
  'crop_ne': new createjs.Shape(),
  'crop_sw': new createjs.Shape(),
  'crop_se': new createjs.Shape(),
  'url': null,
  'offset_x': null,
  'offset_y': null,
  'rotation': 0,
  'polygon': new createjs.Shape(),
  'img': null,
  'scaleActive': false,
  'scaleGroup': new createjs.Container(),
  'scalePoints': [],
  'ppi_field': $('#recto_resolution'),
};

const verso = {
  'name': 'verso',
  'stage': null,
  'cropbox': new createjs.Shape(),
  'crop_nw': new createjs.Shape(),
  'crop_ne': new createjs.Shape(),
  'crop_sw': new createjs.Shape(),
  'crop_se': new createjs.Shape(),
  'url': null,
  'offset_x': null,
  'offset_y': null,
  'rotation': 0,
  'polygon': new createjs.Shape(),
  'img': null,
  'scaleActive': false,
  'scaleGroup': new createjs.Container(),
  'scalePoints': [],
  'ppi_field': $('#verso_resolution'),
};

let name;
let isNameSuggested = false;
let mode = 'crop';
let action = 'move';
let lastUpload = null;
let cropX; let cropY; let cropW; let cropH;
let polygon = [];
let mousestartX; let mousestartY;

/**
 * TODO
 */
function checkIfReady() {
  if (
    recto.url &&
    verso.url &&
    $('#name').val() != '' &&
    $('#verso_resolution').val() != '' &&
    $('#recto_resolution').val() != ''
  ) {
    $('#load_button').removeClass('disabled');
  } else {
    $('#load_button').addClass('disabled');
  }
}

/**
 * TODO
 * @param {*} wrapper
 */
function deactivateCanvas(wrapper) {
  // background -> grau
  wrapper.find('.canvas').css('backgroundColor', 'rgb(50,50,50)');
  // upload_button -> her
  wrapper.find('.upload_button').removeClass('unrendered');
  // button_wrapper -> weg
  wrapper.find('.button_wrapper').addClass('hidden');
  wrapper.find('.resolution_wrapper').addClass('hidden');

  if (!recto.url && !verso.url) {
    $('#mode_wrapper').addClass('hidden');
    $('#switch_wrapper').addClass('hidden');
    clearPolygon();
    resetCropbox();
  }
}

/**
 * TODO
 * @param {*} wrapper
 */
function activateCanvas(wrapper) {
  // background -> white
  wrapper.find('.canvas').css('backgroundColor', 'white');
  // upload_button -> weg
  wrapper.find('.upload_button').addClass('unrendered');
  // button_wrapper -> her
  wrapper.find('.button_wrapper').removeClass('hidden');
  wrapper.find('.resolution_wrapper').removeClass('hidden');

  // activate mode selector
  $('#mode_wrapper').removeClass('hidden');
  // activate middle buttons
  $('#switch_wrapper').removeClass('hidden');
}

/**
 * TODO
 * @param {*} stage
 */
function clearCanvas(stage) {
  stage.removeAllChildren();
  stage.update();
}

/**
 * TODO
 */
function clearPolygon() {
  recto.stage.removeChild(recto.polygon);
  verso.stage.removeChild(verso.polygon);
  recto.polygon = new createjs.Shape();
  verso.polygon = new createjs.Shape();
  polygon = [];
  if (recto.img) recto.img.mask = null;
  if (verso.img) verso.img.mask = null;
  recto.stage.update();
  verso.stage.update();
}

/**
 * TODO
 */
function draw() {
  clearCanvas(recto.stage);
  clearCanvas(verso.stage);
  if (recto.url) drawCanvas('recto_canvas', recto.url);
  if (verso.url) drawCanvas('verso_canvas', verso.url);
  drawMasks();
  drawScale(recto);
  drawScale(verso);
}

/**
 * @return {*}
 */
function mirrorPolygon() {
  const polyVerso = [];
  for (const node in polygon) {
    if (Object.prototype.hasOwnProperty.call(polygon, node)) {
      const coord = polygon[node];
      coord[0] = verso.stage.canvas.width - polygon[node][0];
      polyVerso.push(coord);
    }
  }
  return polyVerso;
}

/**
 * TODO
 * @param {*} canvas
 * @param {*} url
 */
function drawCanvas(canvas, url) {
  let stage;
  let sideWrapper;
  let side;
  if (canvas == 'recto_canvas') {
    stage = recto.stage;
    sideWrapper = recto;
    side = 'rt';
  } else {
    stage = verso.stage;
    sideWrapper = verso;
    side = 'vs';
  }
  canvas = $('#'+canvas);
  stage.canvas.width = canvas.width();
  stage.canvas.height = canvas.height();

  const image = new Image();
  image.src = url;
  image.onload = function() {
    // creating the images
    const imgBack = new createjs.Bitmap(image);
    const img = new createjs.Bitmap(image);

    readExifPPI(image, sideWrapper);

    // getting the current sizes of images and canvas
    const imgWidth = img.image.width;
    const imgHeight = img.image.height;
    const canvasWidth = stage.canvas.width;
    const canvasHeight = stage.canvas.height;

    imgBack.regX = img.regX = imgWidth / 2;
    imgBack.regY = img.regY = imgHeight / 2;

    // determining width and height ratio
    const ratioW = imgWidth / canvasWidth;
    const ratioH = imgHeight / canvasHeight;
    const ratio = Math.max(ratioW, ratioH);

    // reading the saved offset
    let offsetX; let offsetY; let rotation;
    if (side == 'rt') {
      offsetX = recto.offset_x;
      offsetY = recto.offset_y;
      rotation = recto.rotation;
    } else {
      offsetX = verso.offset_x;
      offsetY = verso.offset_y;
      rotation = verso.rotation;
    }

    let x = 0;
    let y = 0;
    if (ratio <= 1) {
      x = (canvasWidth/2); // - (img_width/2);
      y = (canvasHeight/2); // - (img_height/2);
    } else {
      x = (canvasWidth/2); // - ((img_width/ratio)/2);
      y = (canvasHeight/2); // - ((img_height/ratio)/2);
      img.scale /= ratio;
      imgBack.scale /= ratio;
    }
    if (offsetX && offsetY) {
      x = offsetX;
      y = offsetY;
    }
    img.x = imgBack.x = x;
    img.y = imgBack.y = y;

    img.rotation = imgBack.rotation = rotation;

    if (side == 'rt') {
      // img.mask = recto.cropbox;
      recto.img = img;
    } else {
      // img.mask = verso.cropbox;
      verso.img = img;
    }

    const shadow = new createjs.Shape();
    shadow.graphics.beginFill('white');
    shadow.graphics.drawRect(0, 0, canvasWidth, canvasHeight);
    shadow.graphics.endFill();
    shadow.alpha=0.7;

    // adding eventlisteners
    img.on('mousedown', (event) => {
      handleMouseDown(event);
    });
    imgBack.on('mousedown', (event) => {
      handleMouseDown(event);
    });
    shadow.on('mousedown', (event) => {
      handleMouseDown(event);
    });
    img.on('pressmove', (event) => {
      handlePressMove(event);
    });
    imgBack.on('pressmove', (event) => {
      handlePressMove(event);
    });
    shadow.on('pressmove', (event) => {
      handlePressMove(event);
    });

    /**
     * TODO
     * @param {*} event
     */
    function handlePressMove(event) {
      if (!sideWrapper.scaleActive) {
        // if mode is rotate, image should be rotated, not moved
        if (action == 'rotate') {
          rotateImage(event, imgBack, img, side);
        } else if (action == 'move') {
          // if mode is move, move the image
          moveImage(event, imgBack, img, side);
        }
      }
    }

    /**
     * TODO
     * @param {*} event
     */
    function handleMouseDown(event) {
      imgBack.offset_x = event.stageX - imgBack.x;
      imgBack.offset_y = event.stageY - imgBack.y;
      mousestartX = event.stageX;
      mousestartY = event.stageY;
    }

    stage.addChildAt(imgBack, shadow, img, 0);
    drawMasks();
    stage.update();
  };
}

/**
 * TODO
 * @param {*} image
 * @param {*} side
 */
function readExifPPI(image, side) {
  if (side.ppi_field.val() != '') {
    // if there is already a value given, don't change anything
    return;
  }

  try {
    EXIF.getData(image, function() {
      const exifs = EXIF.getAllTags(image);
      if (exifs.XResolution) {
        const ppi = exifs.XResolution.numerator/exifs.XResolution.denominator;
        side.ppi_field.val(ppi);
        checkIfReady();
      } else {
        console.log('Input image has no EXIF data.');
      }
    });
  } catch {
    console.log('Input image has no EXIF data.');
  }
}

/**
 * TODO
 * @param {*} side
 */
function drawPolygon(side) {
  if (!side.url) {
    return;
  }
  if (!side.url || polygon.length == 0) return;

  side.stage.removeChild(side.polygon);

  const poly= new createjs.Shape();
  poly.graphics.beginStroke('green');

  let started = false;

  polygon.push(polygon[0]);

  for (const node in polygon) {
    if (Object.prototype.hasOwnProperty.call(polygon, node)) {
      let x;
      if (side.name == 'recto') {
        x = polygon[node][0];
      } else {
        x = verso.stage.canvas.width - polygon[node][0];
      }
      const y = polygon[node][1];
      if (!started) {
        started = true;
        poly.graphics.moveTo(x, y);
      } else {
        poly.graphics.lineTo(x, y);
      }
    }
  }

  polygon.pop();
  side.polygon = poly;
  if (side.img) side.stage.addChild(side.polygon);
}

/**
 * TODO
 * @param {*} event
 * @param {*} imgBack
 * @param {*} img
 * @param {*} side
 */
function rotateImage(event, imgBack, img, side) {
  const radsOld = Math.atan2(mousestartY - recto.stage.canvas.height/2,
      mousestartX - recto.stage.canvas.width/2);
  const radsNew = Math.atan2(event.stageY - recto.stage.canvas.height/2,
      event.stageX - recto.stage.canvas.width/2);
  const rads = radsNew - radsOld;
  const deltaAngle = rads * (180 / Math.PI);

  imgBack.rotation = (imgBack.rotation + deltaAngle)%360;
  img.rotation = (img.rotation + deltaAngle)%360;

  mousestartX = event.stageX;
  mousestartY = event.stageY;

  if (side == 'rt') {
    recto.rotation = img.rotation;
    recto.stage.update();
  } else {
    verso.rotation = img.rotation;
    verso.stage.update();
  }
}

/**
 * TODO
 * @param {*} event
 * @param {*} imgBack
 * @param {*} img
 * @param {*} side
 */
function moveImage(event, imgBack, img, side) {
  imgBack.x = img.x = event.stageX - imgBack.offset_x;
  imgBack.y = img.y = event.stageY - imgBack.offset_y;

  if (side == 'rt') {
    recto.stage.update();
    recto.offset_x = imgBack.x;
    recto.offset_y = imgBack.y;
  } else {
    verso.stage.update();
    verso.offset_x = imgBack.x;
    verso.offset_y = imgBack.y;
  }
}

/**
 * TODO
 * @param {*} side
 */
function drawCropBox(side) {
  let overlay;

  if (side == 'rt') {
    if (!recto.url) {
      return;
    }
    overlay = recto;
  } else {
    if (!verso.url) {
      return;
    }
    overlay = verso;
  }

  let cropSideX = cropX;
  if (side == 'vs') {
    cropSideX = overlay.stage.canvas.width - cropX - cropW;
  }

  overlay.stage.removeChild(overlay.cropbox, overlay.crop_nw,
      overlay.crop_ne, overlay.crop_sw, overlay.crop_se);

  overlay.cropbox.graphics.clear();
  overlay.cropbox.graphics.setStrokeStyle(1);
  overlay.cropbox.graphics.beginStroke('red');
  overlay.cropbox.graphics.drawRect(cropSideX, cropY, cropW, cropH);

  overlay.crop_nw.graphics.clear();
  overlay.crop_nw.graphics.beginFill('darkred');
  overlay.crop_nw.graphics.drawRect(cropSideX-5, cropY-5, 10, 10);
  overlay.crop_nw.graphics.endFill();

  overlay.crop_ne.graphics.clear();
  overlay.crop_ne.graphics.beginFill('darkred');
  overlay.crop_ne.graphics.drawRect(cropSideX+cropW-5, cropY-5, 10, 10);
  overlay.crop_ne.graphics.endFill();

  overlay.crop_sw.graphics.clear();
  overlay.crop_sw.graphics.beginFill('darkred');
  overlay.crop_sw.graphics.drawRect(cropSideX-5, cropY+cropH-5, 10, 10);
  overlay.crop_sw.graphics.endFill();

  overlay.crop_se.graphics.clear();
  overlay.crop_se.graphics.beginFill('darkred');
  overlay.crop_se.graphics.drawRect(cropSideX+cropW-5, cropY+cropH-5, 10, 10);
  overlay.crop_se.graphics.endFill();

  overlay.stage.addChild(overlay.cropbox, overlay.crop_nw,
      overlay.crop_ne, overlay.crop_sw, overlay.crop_se);
  overlay.stage.update();
}

/**
 * TODO
 * @param {*} event
 * @param {*} loc
 * @param {*} side
 */
function cropSize(event, loc, side) {
  let dx = cropX - event.stageX;
  const dy = cropY - event.stageY;
  if (side == 'rt') {
    if (loc == 'nw') {
      cropX = Math.min(event.stageX, cropX + cropW);
      cropY = Math.min(event.stageY, cropY+cropH);
      cropW = Math.max(cropW + dx, 0);
      cropH = Math.max(cropH + dy, 0);
    } else if (loc == 'ne') {
      cropY = Math.min(event.stageY, cropY+cropH);
      cropH = Math.max(cropH + dy, 0);
      cropW = Math.max(-dx, 0);
    } else if (loc == 'sw') {
      cropX = Math.min(event.stageX, cropX + cropW);
      cropW = Math.max(cropW + dx, 0);
      cropH = Math.max(-dy, 0);
    } else if (loc == 'se') {
      cropW = Math.max(-dx, 0);
      cropH = Math.max(-dy, 0);
    }
  } else {
    const l = verso.stage.canvas.width - cropX - cropW;
    dx = l - event.stageX;
    if (loc == 'nw') {
      cropW = Math.max(cropW + dx, 0);
      cropX = Math.max(recto.stage.canvas.width - event.stageX - cropW, cropX);
      cropY = Math.min(event.stageY, cropY+cropH);
      cropH = Math.max(cropH + dy, 0);
    } else if (loc == 'ne') {
      cropW = Math.max(-dx, 0);
      cropX = Math.min(recto.stage.canvas.width - event.stageX, cropX+cropW);
      cropY = Math.min(event.stageY, cropY+cropH);
      cropH = Math.max(cropH + dy, 0);
    } else if (loc == 'sw') {
      cropW = Math.max(cropW + dx, 0);
      cropX = Math.max(recto.stage.canvas.width - event.stageX - cropW, cropX);
      cropH = Math.max(-dy, 0);
    } else if (loc == 'se') {
      cropW = Math.max(-dx, 0);
      cropX = Math.min(recto.stage.canvas.width - event.stageX, cropX+cropW);
      cropH = Math.max(-dy, 0);
    }
  }

  drawMasks();
}

/**
 * TODO
 */
function drawMasks() {
  recto.stage.removeChild(recto.crop_ne, recto.crop_nw,
      recto.crop_se, recto.crop_sw, recto.cropbox);
  recto.stage.removeChild(recto.polygon);
  verso.stage.removeChild(verso.crop_ne, verso.crop_nw,
      verso.crop_se, verso.crop_sw, verso.cropbox);
  verso.stage.removeChild(verso.polygon);
  if (mode == 'cut') {
    drawPolygon(recto);
    if (recto.img) recto.img.mask = recto.polygon;
    drawPolygon(verso);
    if (verso.img) verso.img.mask = verso.polygon;
  } else if (mode == 'crop') {
    drawCropBox('rt');
    if (recto.img) recto.img.mask = recto.cropbox;
    drawCropBox('vs');
    if (verso.img) verso.img.mask = verso.cropbox;
  }
  recto.stage.update();
  verso.stage.update();
}

/**
 * TODO
 * @param {*} inputSide
 */
function handleScaleButton(inputSide) {
  let side;
  if (inputSide == 'rt') {
    side = recto;
  } else {
    side = verso;
  }

  side.scalePoints = [];
  side.scaleGroup.removeAllChildren();
  side.stage.update();
  side.scaleActive = !side.scaleActive;
}

/**
 * TODO
 * @param {*} event
 * @param {*} side
 */
function addPolygonNode(event, side) {
  let node;
  if (side == 'rt') {
    node = [event.stageX, event.stageY];
  } else {
    node = [verso.stage.canvas.width - event.stageX, event.stageY];
  }
  polygon.push(node);
  drawMasks();
}

/**
 * TODO
 * @param {*} event
 * @param {*} inputSide
 */
function addScalePoint(event, inputSide) {
  const point = [event.stageX, event.stageY];
  let side;

  if (inputSide == 'rt') {
    side = recto;
  } else {
    side = verso;
  }

  side.scalePoints.push(point);

  if (side.scalePoints.length == 1) {
    const point1 = side.scalePoints[0];
    const node = new createjs.Shape();
    node.graphics.beginFill('blue').drawCircle(0, 0, 5);
    node.x = point1[0];
    node.y = point1[1];
    side.scaleGroup.addChild(node);
    side.stage.addChild(side.scaleGroup);
    // zeichne eine linie, die dem mauszeiger folgt
    // zeichne ein 1cm schildchen, das immer an der linie hängt
    side.stage.update();
  } else if (side.scalePoints.length == 2) {
    side.scaleActive = false;
    drawScale(side);
    checkIfReady();
  }
}

/**
 * TODO
 * @param {*} side
 */
function drawScale(side) {
  side.scaleGroup.removeAllChildren();

  if (side.scalePoints.length == 0) {
    side.stage.update();
    return;
  }

  const p1 = side.scalePoints[0];

  const sPoint1 = new createjs.Shape();
  sPoint1.graphics.beginFill('blue').drawCircle(0, 0, 5);
  sPoint1.x = p1[0];
  sPoint1.y = p1[1];
  side.scaleGroup.addChild(sPoint1);

  sPoint1.on('pressmove', (event) => {
    const point = [event.stageX, event.stageY];
    side.scalePoints[0] = point;
    drawScale(side);
  });

  if (side.scalePoints.length == 1) {
    side.stage.update();
    return;
  }

  const p2 = side.scalePoints[1];

  const sPoint2 = new createjs.Shape();
  sPoint2.graphics.beginFill('blue').drawCircle(0, 0, 5);
  sPoint2.x = p2[0];
  sPoint2.y = p2[1];
  side.scaleGroup.addChild(sPoint2);

  sPoint2.on('pressmove', (event) => {
    const point = [event.stageX, event.stageY];
    side.scalePoints[1] = point;
    drawScale(side);
  });

  const line = new createjs.Shape();
  line.graphics.setStrokeStyle(2)
      .beginStroke('blue')
      .moveTo(p1[0], p1[1])
      .lineTo(p2[0], p2[1])
      .endStroke();

  side.scaleGroup.addChildAt(line, 0);

  const sText = new createjs.Text('1 cm');
  sText.scale = 1.5;
  const sTextBounds = sText.getBounds();
  sText.x = (p1[0] + (p2[0]-p1[0])/2) - sTextBounds.width * sText.scale/3;
  sText.y = (p1[1] + (p2[1]-p1[1])/2) + 10;

  const sTextShadow = new createjs.Text('1 cm', '', 'grey');
  sTextShadow.scale = 1.5;
  sTextShadow.x = sText.x + 1;
  sTextShadow.y = sText.y + 1;

  side.scaleGroup.addChild(sTextShadow);
  side.scaleGroup.addChild(sText);

  console.log(side.name, side.scaleGroup);

  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const distance = Math.sqrt((dx*dx + dy*dy));
  const distanceInCm = distance / side.img.scale;
  const distanceInInch = distanceInCm * 2.54;
  side['ppi_field'].val(Math.floor(distanceInInch));

  side.stage.removeChild(side.scaleGroup);
  side.stage.addChild(side.scaleGroup);

  side.stage.update();
}

/**
 * TODO
 */
function updateModeButtons() {
  // check for mode - if crop, hide cut buttons, if cut, show them
  if (mode == 'crop' || mode == 'auto') {
    $('#cut_button').addClass('hidden');
    $('#clear_polygon').addClass('hidden');
    $('#undo_button').addClass('hidden');
  } else if (mode == 'cut') {
    $('#cut_button').removeClass('hidden');
    $('#clear_polygon').removeClass('hidden');
    $('#undo_button').removeClass('hidden');
  }

  // check for action and color according button
  $('.active').removeClass('active');
  if (action == 'move') {
    $('#move_button').addClass('active');
  } else if (action == 'rotate') {
    $('#rotate_button').addClass('active');
  } else if (action == 'cut') {
    $('#cut_button').addClass('active');
  }
}

$(document).ready(function() {
  recto.stage = new createjs.Stage('recto_canvas');
  verso.stage = new createjs.Stage('verso_canvas');

  recto.stage.on('click', function(event) {
    if (recto.scaleActive) {
      addScalePoint(event, 'rt');
    } else if (mode == 'cut' && action == 'cut') {
      addPolygonNode(event, 'rt');
    }
  }, true);
  verso.stage.on('click', function(event) {
    if (verso.scaleActive) {
      addScalePoint(event, 'vs');
    } else if (mode == 'cut' && action == 'cut') {
      addPolygonNode(event, 'vs');
    }
  }, true);

  recto.crop_nw.on('pressmove', (event)=>{
    cropSize(event, 'nw', 'rt');
  });
  recto.crop_ne.on('pressmove', (event)=>{
    cropSize(event, 'ne', 'rt');
  });
  recto.crop_sw.on('pressmove', (event)=>{
    cropSize(event, 'sw', 'rt');
  });
  recto.crop_se.on('pressmove', (event)=>{
    cropSize(event, 'se', 'rt');
  });

  verso.crop_nw.on('pressmove', (event)=>{
    cropSize(event, 'nw', 'vs');
  });
  verso.crop_ne.on('pressmove', (event)=>{
    cropSize(event, 'ne', 'vs');
  });
  verso.crop_sw.on('pressmove', (event)=>{
    cropSize(event, 'sw', 'vs');
  });
  verso.crop_se.on('pressmove', (event)=>{
    cropSize(event, 'se', 'vs');
  });

  resetCropbox();
});

/**
 * TODO
 */
function resetCropbox() {
  cropW = Math.floor($('#recto_canvas').width()/2);
  cropH = Math.floor($('#recto_canvas').height()/2);
  cropX = cropW/2;
  cropY = cropH/2;
}

$('.bin_button').click(function() {
  const wrapper = $(this).parent().parent();
  let side;

  if ($(this).attr('id') == 'recto_bin_button') {
    side = recto;
  } else {
    side = verso;
  }
  side.url = null;
  side.image = null;
  side.offset_x = null;
  side.offset_y = null;
  side.rotation = 0;
  side.ppi_field.val('');
  side.scalePoints = [];
  clearCanvas(side.stage);

  deactivateCanvas(wrapper);
  checkIfReady();
});

$('.local_upload_button').click(function() {
  if ($(this).attr('id') == 'recto_local_upload') {
    lastUpload = 'recto';
  } else {
    lastUpload = 'verso';
  }

  ipcRenderer.send('server-upload-image');
});

$('#verso_resolution').on('keyup', function() {
  verso.scalePoints = [];
  drawScale(verso);
  checkIfReady();
});
$('#recto_resolution').on('keyup', function() {
  recto.scalePoints = [];
  drawScale(recto);
  checkIfReady();
});

$('#clear_polygon').click(function() {
  if (mode == 'cut') {
    clearPolygon();
  }
});

$('#name').on('keyup', function() {
  if ($(this).val() == '') {
    isNameSuggested = false;
  } else {
    isNameSuggested = true;
  }
  checkIfReady();
});

$('.www_upload_button').click(function() {
  if ($(this).attr('id') == 'recto_www_upload') {
    lastUpload = 'recto';
  } else {
    lastUpload = 'verso';
  }

  try {
    dialogs.prompt('Enter Image-URL:', function(url) {
      if (url != '' && url != null) {
        if (lastUpload == 'recto') {
          recto.url = url;
          activateCanvas($('#recto_canvas_wrapper'));
          drawCanvas('recto_canvas', url);
        } else {
          verso.url = url;
          activateCanvas($('#verso_canvas_wrapper'));
          drawCanvas('verso_canvas', url);
        }
        lastUpload = null;
        checkIfReady();
      }
    });
  } catch {
    alert('Please make sure your image URL leads to an image file (jpg, png)!');
  }
});

$('#load_button').click(function() {
  if (!$('#load_button').hasClass('disabled')) {
    /*
    3. alle polygonpunkte müssten umgerechnet werden
    in relation zum eigentlichen bild
    */
    const polygonRecto = [];
    const polygonVerso = [];

    if (mode == 'crop') {
      // cropMode is active - infer polygon nodes from vertices
      const xRecto = cropX - recto.img.x + recto.img.image.width/2;
      const yRecto = cropY - recto.img.y + recto.img.image.height/2;
      polygonRecto.push([xRecto, yRecto]);
      polygonRecto.push([xRecto, yRecto+cropH]);
      polygonRecto.push([xRecto+cropW, yRecto+cropH]);
      polygonRecto.push([xRecto+cropW, yRecto]);
      polygonRecto.push([xRecto, yRecto]);

      const xVerso = verso.stage.canvas.width - cropX - cropW -
        verso.img.x + verso.img.image.width/2;
      const yVerso = cropY - verso.img.y + verso.img.image.height/2;
      polygonVerso.push([xVerso, yVerso]);
      polygonVerso.push([xVerso, yVerso+cropH]);
      polygonVerso.push([xVerso+cropW, yVerso+cropH]);
      polygonVerso.push([xVerso+cropW, yVerso]);
      polygonVerso.push([xVerso, yVerso]);
    } else {
      // cutMode is active
      let temp = [...polygon];
      temp.push(temp[0]);
      for (const node in temp) {
        if (Object.prototype.hasOwnProperty.call(temp, node)) {
          const coord = temp[node];
          polygonRecto.push([coord[0]-recto.img.x-recto.img.image.width/2,
            coord[1]-recto.img.y-recto.img.image.height/2]);
        }
      }

      temp = mirrorPolygon();
      temp.push(temp[0]);
      for (const node in temp) {
        if (Object.prototype.hasOwnProperty.call(temp, node)) {
          const coord = temp[node];
          polygonVerso.push([coord[0]-verso.img.x-verso.img.image.width/2,
            coord[1]-verso.img.y-verso.img.image.height/2]);
        }
      }
    }

    const fragmentData = {
      'rectoURL': recto.url,
      'versoURL': verso.url,
      'recto': true,
      'name': $('#name').val(),
      'rotation': recto.rotation,
      'rotationDistance': recto.rotation + verso.rotation,
      'rectoMask': polygonRecto,
      'versoMask': polygonVerso,
      'rectoPPI': $('#recto_resolution').val(),
      'versoPPI': $('#verso_resolution').val(),
    };
    ipcRenderer.send('server-upload-ready', fragmentData);
  }
});


$('#switch_button').click(function() {
  // don't allow a context switch when scaling is active
  if (recto.scaleActive || verso.scaleActive) {
    return;
  }
  // switch image URL
  let temp = recto.url;
  recto.url = verso.url;
  verso.url = temp;

  // switch offset
  temp = recto.offset_x;
  recto.offset_x = verso.offset_x;
  verso.offset_x = temp;

  // switch offsets
  temp = recto.offset_y;
  recto.offset_y = verso.offset_y;
  verso.offset_y = temp;

  // switch rotation of images
  temp = recto.rotation;
  recto.rotation = verso.rotation;
  verso.rotation = temp;

  // switch imgs (which is the top image layer)
  temp = recto.img;
  recto.img = verso.img;
  verso.img = temp;

  // switch polygons
  temp = recto.polygon;
  recto.polygon = verso.polygon;
  verso.polygon = temp;

  // switch scaling elements
  temp = recto.scaleGroup;
  recto.scaleGroup = verso.scaleGroup;
  verso.scaleGroup = temp;
  temp = recto.scalePoints;
  recto.scalePoints = verso.scalePoints;
  verso.scalePoints = temp;

  // crop_x is the only thing changing when mirroring the
  // canvas horizontally; thus, it must be converted
  cropX = recto.stage.canvas.width - cropX - cropW;

  const newPolygon = [];
  for (const idx in polygon) {
    if (Object.prototype.hasOwnProperty.call(polygon, idx)) {
      // const x = verso.stage.canvas.width - polygon[idx][0];
      const x = $('#verso_canvas').width() - polygon[idx][0];
      const y = polygon[idx][1];
      newPolygon.push([x, y]);
    }
  }
  polygon = newPolygon;

  deactivateCanvas($('#recto_canvas_wrapper'));
  deactivateCanvas($('#verso_canvas_wrapper'));
  if (recto.url) activateCanvas($('#recto_canvas_wrapper'));
  if (verso.url) activateCanvas($('#verso_canvas_wrapper'));
  draw();
});

$('#cut_button').click(function() {
  action = 'cut';
  updateModeButtons();
  if (recto.img) recto.img.mask = recto.polygon;
  if (verso.img) verso.img.mask = verso.polygon;
  drawMasks();
});

$('#cropcut_button').click(function() {
  if (mode == 'crop') {
    // switch to cut mode
    mode = 'cut';
    if (polygon.length == 0) {
      action = 'cut';
    }
    $('#cropcut_button img').attr('src', '../imgs/symbol_cut.png');
  } else {
    // switch to crop mode
    mode = 'crop';
    action = 'move';
    $('#cropcut_button img').attr('src', '../imgs/symbol_crop.png');
  }
  updateModeButtons();
  drawMasks();
});

$('.select_button').click(function(event) {
  $('.select_button.selected').removeClass('selected');
  $(this).addClass('selected');
  mode = $(this).attr('mode');
  if (mode == 'cut') {
    action = 'cut';
  }
  updateModeButtons();
  drawMasks();
});

$('#move_button').click(function() {
  action = 'move';
  updateModeButtons();
});

$('#rotate_button').click(function() {
  action ='rotate';
  updateModeButtons();
});

$('#undo_button').click(function() {
  polygon.pop();
  drawMasks();
});

$('#recto_scale_button').click(() => {
  handleScaleButton('rt');
});
$('#verso_scale_button').click(() => {
  handleScaleButton('vs');
});


/* ipcRenderer.on('upload-image-path', (event, filepath) => {
    if (!recto.url) {
        recto.url = filepath;
        activateCanvas($('#recto_canvas_wrapper'));
        draw('recto_canvas', filepath);
    } else {
        verso.url = filepath;
        activateCanvas($('#verso_canvas_wrapper'));
        draw('verso_canvas', filepath);
    }
});*/

ipcRenderer.on('upload-receive-image', (event, filepath) => {
  name = filepath.split('\\').pop().split('/').pop();
  name = name.replace(/\.[^/.]+$/, '');

  if (!isNameSuggested) {
    $('#name').val(name);
    isNameSuggested = true;
  }

  if (lastUpload == 'recto') {
    recto.url = filepath;
    activateCanvas($('#recto_canvas_wrapper'));
    // drawCanvas('recto_canvas', filepath);
  } else {
    verso.url = filepath;
    activateCanvas($('#verso_canvas_wrapper'));
    // drawCanvas('verso_canvas', filepath);
  }
  draw();
  lastUpload = null;
  checkIfReady();
});
