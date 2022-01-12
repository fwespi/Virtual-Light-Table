const {ipcRenderer} = require('electron');

const batchSize = 25;
let lastIndex = -1;
const filters = [];

$(document).ready(() => {
  requestBatch(lastIndex+1, lastIndex+batchSize);
  /*
    ### 1. Anfrage an Server: DATEN! ('server-load-tpop-json')

    */
});

/**
 *
 * @param {*} startIndex
 * @param {*} endIndex
 */
function requestBatch(startIndex, endIndex) {
  const data = {
    'startIndex': startIndex,
    'endIndex': endIndex,
  };
  ipcRenderer.send('server-load-tpop-json', data);
  lastIndex = endIndex;
}

function requestDetails(id) {
  ipcRenderer.send('server-tpop-details', id);
}

function displayDetails(details) {
  $('#detail-name').html('--- '+details.name+' ---');
  $('#detail-recto').attr('src', details.urlRecto);
  $('#detail-verso').attr('src', details.urlVerso);
}

function updateLoadButton() {
  const objectsToLoad = $('.loading').length;
  if (objectsToLoad > 0) {
    $('#load-text').html('Load '+objectsToLoad+' fragment(s)');
    $('#load').removeClass('inactive');
  } else {
    $('#load-text').html('Select fragments');
    $('#load').addClass('inactive');
  }
}

/**
 *
 * @param {*} event
 */
function resizeSidebar(event) {
  const x = event.pageX;
  $('#sidebar').css('width', x);
}

/**
 *
 * @param {*} event
 */
function resizeDetailView(event) {
  const x = event.pageX;
  const view_w = $(window).width();
  $('#detail-view').css('width', view_w-x);
}

/**
 *
 * @param {*} data
 */
function addTile(data) {
  const tile = $('<div id="'+data.name+'" class="tile no-select" data-id="'+data.name+'"></div>');
  const img = $('<img src="'+data.urlRecto+'" data-id="'+data.name+'"/>');
  const name = $('<div class="name" data-id="'+data.name+'">'+data.name+'</div>');
  const distance = $('<div class="distance">xx.xxxx</div>');
  const multibox = $('<div class="multibox" data-id="'+data.name+'"></div>');

  tile.append(img);
  tile.append(name);
  tile.append(distance);
  tile.append(multibox);
  $('#tile-view').append(tile);

  tile.click(function(event) {
    const dataId = $(event.target).attr('data-id');
    const tempDataId = dataId.replace('/', '\\/');

    if ($('#'+tempDataId).hasClass('selected')) {
      $('#'+tempDataId).toggleClass('loading');
      updateLoadButton();
    } else {
      $('.selected').removeClass('selected');
      $('#'+tempDataId).addClass('selected');
    }

    requestDetails(dataId);
  });

  multibox.click(function(event) {
    event.stopPropagation();
    const tile = $(event.target).parent();
    const id = tile.attr('id').replace('/', '\\/');
    if (tile.hasClass('loading')) {
      tile.removeClass('loading');
      $('#load-'+id).remove();
    } else {
      tile.addClass('loading');
      const tileClone = tile.clone();
      tileClone.attr('id', 'load-'+id);
      tileClone.removeClass('selected');
      $('#loading-view').append(tileClone);
    }
    updateLoadButton();
  });
}

$('#left-resize-slider').on('mousedown', (event) => {
  $(window).on('mousemove', (event) => {
    resizeSidebar(event);
  });
});

$('#right-resize-slider').on('mousedown', (event) => {
  $(window).on('mousemove', (event) => {
    resizeDetailView(event);
  });
});
$(window).on('mouseup', (event) => {
  $(window).off('mousemove');
});

$('#filter-add').click((event) => {
  $('#filter-overlay').css('display', 'flex');
});

$('#filter-add-button').click((event) => {
  const attribute = $('#filter-attribute').val();
  const operator = $('#filter-operator').val();
  const value = $('#filter-input').val();

  const filter = $('<div class="filter"></div>');
  filter.attr('data-attribute', attribute);
  filter.attr('data-operator', operator);
  filter.attr('data-value', value);

  const filterDescriptor = $('<div class="filter-descriptor">'+attribute+' '+operator+' '+value+'</div>');
  const filterDelete = $('<div class="filter-delete no-select">x</div>');

  filterDelete.click(function(event) {
    $(this).parent().remove();
  });

  filter.append(filterDescriptor);
  filter.append(filterDelete);

  $('#filter-list').append(filter);
  $('#filter-overlay').css('display', 'none');
});

$('#filter-close').click(function(event) {
  $('#filter-overlay').css('display', 'none');
});

$('html').keydown(function(event) {
  if (event.keyCode == 27) {
    // ESC -> close filter view
    $('#filter-overlay').css('display', 'none');
  }
});

ipcRenderer.on('tpop-json-data', (event, tpopJson) => {
  // show data
  for (const [key, value] of Object.entries(tpopJson)) {
    addTile(value);
  }
});

ipcRenderer.on('tpop-json-failed', () => {
  // show error message
  // show options to close or retry
  console.log('json failed');
});

ipcRenderer.on('tpop-details', (event, details) => {
  displayDetails(details);
});
