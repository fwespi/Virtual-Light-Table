'use strict';

const {ipcRenderer} = require('electron');

let saves;
const defaultFolder = './saves/';

/**
 * TODO
 */
function selectDefaultFolder() {
  $('#folder').val(defaultFolder);
  ipcRenderer.send('server-list-savefiles', defaultFolder);
}

$(document).ready(function() {
  selectDefaultFolder();
});

/**
 * TODO
 * @param {*} milliseconds
 * @return {*}
 */
function convertTime(milliseconds) {
  const time = new Date(milliseconds);

  const year = time.getFullYear();
  const month = ((time.getMonth()+1) < 10 ? '0' : '') + (time.getMonth()+1);
  const day = (time.getDate() < 10 ? '0' : '') + time.getDate();

  const hour = time.getHours();
  const minute = (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
  const second = (time.getSeconds() < 10 ? '0' : '') + time.getSeconds();

  return day+'.'+month+'.'+year+', '+hour+':'+minute+':'+second;
}


/* ##########################################
#               INPUT/OUTPUT
###########################################*/

$('#default_folder').click(selectDefaultFolder);

$('#select_folder').click(function() {
  ipcRenderer.send('server-get-saves-folder');
});

$('#save_list').on('click', '.save_list_item', function() {
  const filename = $(this).attr('id');
  $('.save_list_item').removeClass('selected');
  $(this).addClass('selected');
  $('#load').removeClass('disabled');
  $('#delete').removeClass('disabled');
  $('#thumb_reconstruction').css('display', 'inline-block');
  $('#thumb_reconstruction').empty();

  const thumbnail = document.createElement('img');
  thumbnail.src = saves[filename].screenshot;
  document.getElementById('thumb_reconstruction').appendChild(thumbnail);

  $('#load_details').css('display', 'inline-block');

  const fragments = saves[filename].fragments;

  // Create the load_details_section
  const editors = saves[filename].editors;
  if (editors) {
    editors.sort(function(a, b) {
      return a[1] - b[1];
    });
  }
  const annots = saves[filename].annots;
  let annotItems;
  if (annots) {
    annotItems = Object.keys(annots).map(function(key) {
      return [key, annots[key]];
    });
    annotItems.sort(function(a, b) {
      return a.time - b.time;
    });
  }

  const table = document.createElement('table');

  // create filename row
  const filenameBody = document.createElement('tbody');
  filenameBody.setAttribute('id', 'details_filename');
  const filenameRow = document.createElement('tr');
  const filenameTd1 = document.createElement('td');
  filenameTd1.setAttribute('class', 'label');
  const filenameTd2 = document.createElement('td');
  filenameTd2.setAttribute('class', 'content');
  filenameTd1.appendChild(document.createTextNode('Filename:'));
  filenameTd2.appendChild(document.createTextNode(filename));
  filenameRow.appendChild(filenameTd1);
  filenameRow.appendChild(filenameTd2);
  filenameBody.append(filenameRow);
  table.appendChild(filenameBody);


  // create editor rows:
  let firstEditor = true;
  const editorBody = document.createElement('tbody');
  editorBody.setAttribute('id', 'details_editors');
  for (const idx in editors) {
    if (Object.prototype.hasOwnProperty.call(editors, idx)) {
      const editor = editors[idx][0];
      const time = convertTime(editors[idx][1]);
      const editorRow = document.createElement('tr');
      const editorTd1 = document.createElement('td');
      editorTd1.setAttribute('class', 'label');
      const editorTd2 = document.createElement('td');
      editorTd2.setAttribute('class', 'content');
      if (firstEditor) {
        firstEditor = false;
        editorRow.setAttribute('class', 'first_row');
        editorTd1.appendChild(document.createTextNode('Last Editors:'));
      }
      editorTd2.appendChild(document.createTextNode('\u2022 ' +
            editor + ' (' + time + ')'));
      editorRow.appendChild(editorTd1);
      editorRow.appendChild(editorTd2);
      editorBody.appendChild(editorRow);
    }
  }
  table.appendChild(editorBody);

  // create annotation rows:
  let firstAnnot = true;
  const annotBody = document.createElement('tbody');
  annotBody.setAttribute('id', 'details_annots');
  for (const idx in annotItems) {
    if (Object.prototype.hasOwnProperty.call(annotItems, idx)) {
      const annotId = annotItems[idx][0];
      const annot = annots[annotId].text;
      const editor = annots[annotId].editor;
      const time = convertTime(annots[annotId].time);
      const annotRow = document.createElement('tr');
      const annotTd1 = document.createElement('td');
      annotTd1.setAttribute('class', 'label');
      const annotTd2 = document.createElement('td');
      annotTd2.setAttribute('class', 'content');
      if (firstAnnot) {
        firstAnnot = false;
        annotRow.setAttribute('class', 'first_row');
        annotTd1.appendChild(document.createTextNode('Annotations:'));
      }
      annotTd2.appendChild(document.createTextNode('\u2022 ' +
            annot + ' (' + editor + ', ' + time + ')'));
      annotRow.appendChild(annotTd1);
      annotRow.appendChild(annotTd2);
      annotBody.appendChild(annotRow);
    }
  }
  table.appendChild(annotBody);


  $('#load_details').empty().append(table);

  $('#thumb_list').empty();

  try {
    for (const [key, value] of Object.entries(fragments)) {
      let url; let rt;
      if (fragments[key].recto ? url = fragments[key].rectoURL :
        url = fragments[key].versoURL);
      if (fragments[key].recto ? rt = 'rt' : rt = 'vs');
      let newTile = '<div class=\'load_thumb\'>';
      newTile += '<img class=\'load_thumb_img\' src=\''+url+'\'>';
      newTile += '<span class=\'load_thumb_text\'>'+
        fragments[key].name+' ('+rt+')</span>';
      newTile += '</div>';
      $('#thumb_list').append(newTile);
    }
  } catch (err) {
    console.log(err);
    $('#thumb_reconstruction').css('display', 'none');
    $('#load_details').css('display', 'none');
    $('#thumb_list').append('<div class=\'error_message\'>'+
        'Save file broken!</div>');
    $('#load').prop('disabled', true);
  }
});

$('#load').click(function() {
  if (!$('#load').hasClass('disabled')) {
    ipcRenderer.send('server-load-file', (saves[$('.selected').attr('id')]));
  }
});

$('#delete').click(function() {
  // 0. nur etwas machen, wenn der Button überhaupt aktiv ist
  if ($(this).hasClass('disabled')) {
    return false;
  }
  // 1. um welches Savefile geht es?
  const filename = $('.selected').attr('id');
  // 2. Bestätigungsdialog
  const confirmation = confirm('Do you really want to delete'+
        'this savefile? This action is not revertable.');
  // 3. Nachricht an Server: Save löschen
  if (confirmation) {
    ipcRenderer.send('server-delete-save', filename);
  }
  // [4. Nachricht von Server mit aktuellem Speicherzustand]
});

/* ##########################################
#           SERVER/CLIENT PROTOCOL
###########################################*/

// return-save-files
ipcRenderer.on('return-save-files', (event, savefiles) => {
  $('#save_list_body').empty();
  $('#thumb_list').empty();
  $('#load').addClass('disabled');
  $('#delete').addClass('disabled');
  $('#thumb_reconstruction').css('display', 'none');
  $('#load_details').css('display', 'none');
  saves = savefiles;
  for (const [key, value] of Object.entries(savefiles)) {
    let lastEditor = '';
    let numberFragments = '';
    if ('editors' in saves[key]) {
      lastEditor = saves[key].editors.slice(-1)[0];
    }
    if ('fragments' in saves[key]) {
      numberFragments = Object.keys(saves[key].fragments).length;
    }

    let tableRow = '<tr class=\'save_list_item\' id=\''+key+'\'>';
    tableRow += '<td class=\'td_filename\'>'+key+'</td>';
    tableRow += '<td class=\'td_fragments\'>'+numberFragments+'</td>';
    console.log(saves[key]);
    tableRow += '<td class=\'td_mtime\'>'+convertTime(saves[key].mtime)+'</td>';
    tableRow += '<td class=\'td_editor\'>'+lastEditor[0]+'</tr>';

    $('#save_list_body').append(tableRow);
  }
});

// return-saves-folder
ipcRenderer.on('return-saves-folder', (event, path) => {
  $('#folder').val(path);
  ipcRenderer.send('server-list-savefiles', path);
});
