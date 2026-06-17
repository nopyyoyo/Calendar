const SPREADSHEET_ID = "1jisnmOm3alIrL1fRPH_QEbB39jhaXIwhRYGhAx64jvw";

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_() {
  return getSpreadsheet_().getSheets()[0];
}

function getPersonSheet_() {
  return getSpreadsheet_().getSheetByName("Person");
}

function doGet(e) {
  return handleRequest("GET", e);
}

function doPost(e) {
  return handleRequest("POST", e);
}

function handleRequest(method, e) {
  try {
    if (method === "GET") {
      const action = (e && e.parameter && e.parameter.action) || "list";

      if (action === "list") {
        return json_(listItems_());
      }

      if (action === "persons") {
        return json_(listPersons_());
      }

      return json_({
        status: "error",
        message: "Unsupported GET action",
      });
    }

    if (method === "POST") {
      const action = (e && e.parameter && e.parameter.action) || "add";
      const data = parseBody_(e);

      if (action === "add") {
        addItem_(data);
        return json_({ status: "ok" });
      }

      if (action === "update") {
        updateItem_(data);
        return json_({ status: "ok" });
      }

      if (action === "delete") {
        deleteItem_(data);
        return json_({ status: "ok" });
      }

      return json_({
        status: "error",
        message: "Unsupported POST action",
      });
    }

    return json_({
      status: "error",
      message: "Unsupported method",
    });
  } catch (err) {
    return json_({
      status: "error",
      message: err.toString(),
    });
  }
}

function listPersons_() {
  const personSheet = getPersonSheet_();

  if (!personSheet) {
    return [];
  }

  const lastRow = personSheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  // Person tab columns: A=Person, B=Color Theme
  const values = personSheet.getRange(2, 1, lastRow - 1, 2).getValues();

  return values
    .map(function (r) {
      return {
        person: String(r[0] || "").trim(),
        colorTheme: String(r[1] || "").trim(),
      };
    })
    .filter(function (entry) {
      return entry.person !== "";
    });
}

function listItems_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 7);

  if (lastRow <= 1) {
    return [];
  }

  // Columns: A=date, B=time, C=item, D=description, E=person, F=dateTo, G=timeTo
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const data = values.map(function (r, i) {
    const rawDate = r[0];
    let dateStr = "";

    if (Object.prototype.toString.call(rawDate) === "[object Date]" && !isNaN(rawDate)) {
      dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      dateStr = String(rawDate || "").trim();
    }

    const rawDateTo = r[5];
    let dateToStr = "";

    if (Object.prototype.toString.call(rawDateTo) === "[object Date]" && !isNaN(rawDateTo)) {
      dateToStr = Utilities.formatDate(rawDateTo, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      dateToStr = String(rawDateTo || "").trim();
    }

    return {
      rowId: i + 2,
      date: dateStr,
      time: String(r[1] || "").trim(),
      item: String(r[2] || "").trim(),
      description: String(r[3] || "").trim(),
      person: String(r[4] || "").trim(),
      dateTo: dateToStr,
      timeTo: String(r[6] || "").trim(),
    };
  });

  return data;
}

function addItem_(data) {
  const sheet = getSheet_();

  sheet.appendRow([
    data.date || "",
    data.time || "",
    data.item || "",
    data.description || "",
    data.person || "",
    data.dateTo || "",
    data.timeTo || "",
  ]);
}

function updateItem_(data) {
  const sheet = getSheet_();
  const rowId = Number(data.rowId);

  if (!rowId || rowId < 2 || rowId > sheet.getLastRow()) {
    throw new Error("Invalid rowId");
  }

  sheet.getRange(rowId, 1, 1, 7).setValues([[
    data.date || "",
    data.time || "",
    data.item || "",
    data.description || "",
    data.person || "",
    data.dateTo || "",
    data.timeTo || "",
  ]]);
}

function deleteItem_(data) {
  const sheet = getSheet_();
  const rowId = Number(data.rowId);

  if (!rowId || rowId < 2 || rowId > sheet.getLastRow()) {
    throw new Error("Invalid rowId");
  }

  sheet.deleteRow(rowId);
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
