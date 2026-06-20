/**
 * TOMAUNO - VISOR DE VENTAS PARA VERCEL
 * Backend rápido con Apps Script + Google Drive + Google Sheets.
 * Publicar como Web App: Ejecutar como YO / Acceso: Cualquier persona.
 */

var ROOT_FOLDER_ID = "1KVOGHJWK-xT3nmSvNuN9YH8EyFTWgXW4";
var SS_ID = "1rIyOYIw2m1LmWoEfinNYjGG3Sb8mOD6tN1g2RM-VYvc";
var MI_WHATSAPP = "5493764354522";

// Si las miniaturas no cargan por permisos, dejar true.
// Para 2000+ fotos puede tardar un poco la primera vez, pero luego queda público con link.
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
      return json_({ photos: getPhotos_(folderId) });
    }

    return json_({ success: false, msg: "Acción GET no válida: " + action });
  } catch (err) {
    return json_({ success: false, msg: err.toString() });
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || "{}");
    var action = data.action || "submitOrder";

    if (action === "submitOrder") {
      return json_(submitOrder_(data));
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
        // lh3 suele funcionar mejor desde Vercel que drive.google.com/thumbnail
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

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Fecha", "Cliente", "WhatsApp", "Evento", "Tipo", "Cant", "Total", "Fotos", "Notas"]);
  }

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
    data.notes || ""
  ]);

  return { success: true, whatsappNumber: MI_WHATSAPP };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
