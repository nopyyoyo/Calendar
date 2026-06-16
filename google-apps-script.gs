function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "list";

    if (action === "list") {
      return listItems_();
    }

    return json_({
      status: "error",
      message: "Unsupported GET action",
    });
  } catch (err) {
    return json_({
      status: "error",
      message: err.toString(),
    });
  }
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "add";
    const data = parseBody_(e);

    if (action === "add") {
      return addItem_(data);
    }

    if (action === "update") {
      return updateItem_(data);
    }

    if (action === "delete") {
      return deleteItem_(data);
    }

    return json_({
      status: "error",
      message: "Unsupported POST action",
    });
  } catch (err) {
    return json_({
      status: "error",
      message: err.toString(),
    });
  }
}

function listItems_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 5);

  if (lastRow <= 1) {
    return json_([]);
  }

  // Columns: A=date, B=time, C=item, D=description, E=person
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const data = values.map(function (r, i) {
    const rawDate = r[0];
    let dateStr = "";

    if (Object.prototype.toString.call(rawDate) === "[object Date]" && !isNaN(rawDate)) {
      dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      dateStr = String(rawDate || "").trim();
    }

    return {
      rowId: i + 2,
      date: dateStr,
      time: String(r[1] || "").trim(),
      item: String(r[2] || "").trim(),
      description: String(r[3] || "").trim(),
      person: String(r[4] || "").trim(),
    };
  });

  return json_(data);
}

function addItem_(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  sheet.appendRow([
    data.date || "",
    data.time || "",
    data.item || "",
    data.description || "",
    data.person || "",
  ]);

  return json_({ status: "ok" });
}

function updateItem_(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rowId = Number(data.rowId);

  if (!rowId || rowId < 2 || rowId > sheet.getLastRow()) {
    return json_({
      status: "error",
      message: "Invalid rowId",
    });
  }

  sheet.getRange(rowId, 1, 1, 5).setValues([[
    data.date || "",
    data.time || "",
    data.item || "",
    data.description || "",
    data.person || "",
  ]]);

  return json_({ status: "ok" });
}

function deleteItem_(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rowId = Number(data.rowId);

  if (!rowId || rowId < 2 || rowId > sheet.getLastRow()) {
    return json_({
      status: "error",
      message: "Invalid rowId",
    });
  }

  sheet.deleteRow(rowId);
  return json_({ status: "ok" });
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (jsonErr) {
      // Fall through to parameter payload.
    }
  }

  return (e && e.parameter) ? e.parameter : {};
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
