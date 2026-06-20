/**
 * TOMAUNO - VISOR DE VENTAS PARA VERCEL
 * Backend con Apps Script + Google Drive + Google Sheets.
 */

var ROOT_FOLDER_ID = "1KVOGHJWK-xT3nmSvNuN9YH8EyFTWgXW4";
var SS_ID = "1rIyOYIw2m1LmWoEfinNYjGG3Sb8mOD6tN1g2RM-VYvc";
var MI_WHATSAPP = "5493764354522";
var AUTO_SHARE_IMAGES = true;

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "events";

    if (action === "events") {
      return json_(getEvents_());
    }

    if (action === "photos") {
      var folderId = e.parameter.folderId;
      if (!folderId) throw new Error("Falta folderId");
      return json_({ success: true, photos: getPhotos_(folderId) });
    }

    if (action === "orders") {
      var pin = e.parameter.pin || "";
      if (pin !== "3233") throw new Error("PIN inválido");
      return json_({ success: true, orders: getOrders_() });
    }

    return json_({ success: false, msg: "Acción GET no válida: " + action });

  } catch (err) {
    return json_({ success: false, msg: err.toString() });
  }
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : "{}");
    var action = data.action || "submitOrder";

    if (action === "submitOrder") {
      return json_(submitOrder_(data));
    }

    if (action === "updateOrder") {
      if ((data.pin || "") !== "3233") throw new Error("PIN inválido");
      return json_(updateOrder_(data));
    }

    return json_({ success: false, msg: "Acción POST no válida: " + action });

  } catch (err) {
    return json_({ success: false, msg: err.toString() });
  }
}

function getEvents_() {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var folders = root.getFolders();
  var list = [];

  while (folders.hasNext()) {
    var f = folders.next();
    var parts = f.getName().split("_");

    list.push({
      displayName: parts[0] || f.getName(),
      pass: parts[1] || "",
      pDigital: Number(parts[2]) || 1500,
      pPrint: Number(parts[3]) || 3000,
      pFull: Number(parts[4]) || 0,
      id: f.getId()
    });
  }

  list.sort(function(a, b) {
    return a.displayName.localeCompare(b.displayName);
  });

  return { success: true, events: list };
}

function getPhotos_(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var photos = [];

  while (files.hasNext()) {
    var f = files.next();
    var mime = f.getMimeType();

    if (mime && mime.indexOf("image") > -1) {
      var id = f.getId();

      if (AUTO_SHARE_IMAGES) {
        try {
          f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e) {}
      }

      photos.push({
        id: id,
        name: f.getName(),
        urlWeb: "https://lh3.googleusercontent.com/d/" + id + "=w1000",
        urlThumb: "https://lh3.googleusercontent.com/d/" + id + "=w400",
        urlFull: "https://drive.google.com/uc?export=download&id=" + id
      });
    }
  }

  photos.sort(function(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  return photos;
}

function submitOrder_(data) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName("Pedidos_Tomauno") || ss.insertSheet("Pedidos_Tomauno");

  ensureHeader_(sheet);

  var photoNames = data.photoNames || [];
  var photos = data.photos || [];

  sheet.appendRow([
    new Date(),
    data.name || "",
    data.phone || "",
    data.eventName || "",
    data.orderType || "",
    photos.length,
    data.total || 0,
    photoNames.join(", "),
    data.notes || "Sin observaciones",
    "PENDIENTE",
    "PENDIENTE"
  ]);

  return {
    success: true,
    whatsappNumber: MI_WHATSAPP,
    row: sheet.getLastRow()
  };
}

function ensureHeader_(sheet) {
  var header = [
    "Fecha",
    "Cliente",
    "WhatsApp",
    "Evento",
    "Tipo",
    "Cantidad",
    "Total",
    "Fotos",
    "Observaciones",
    "Pago",
    "Entrega"
  ];

  var lastColumn = Math.max(sheet.getLastColumn(), header.length);
  var existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  for (var i = 0; i < header.length; i++) {
    if (existing[i] !== header[i]) {
      sheet.getRange(1, i + 1).setValue(header[i]);
    }
  }

  sheet.setFrozenRows(1);
}

function getOrders_() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName("Pedidos_Tomauno");
  if (!sheet) return [];

  ensureHeader_(sheet);

  var last = sheet.getLastRow();
  if (last < 2) return [];

  var values = sheet.getRange(2, 1, last - 1, 11).getValues();

  return values.map(function(r, i) {
    return {
      row: i + 2,
      fecha: r[0],
      cliente: r[1],
      whatsapp: r[2],
      evento: r[3],
      tipo: r[4],
      cantidad: r[5],
      total: r[6],
      fotos: r[7],
      observaciones: r[8],
      pago: r[9] || "PENDIENTE",
      entrega: r[10] || "PENDIENTE"
    };
  });
}

function updateOrder_(data) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName("Pedidos_Tomauno");
  if (!sheet) throw new Error("No existe hoja Pedidos_Tomauno");

  ensureHeader_(sheet);

  var row = Number(data.row);
  if (!row || row < 2) throw new Error("Fila inválida");

  if (data.pago) sheet.getRange(row, 10).setValue(data.pago);
  if (data.entrega) sheet.getRange(row, 11).setValue(data.entrega);

  return { success: true };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
