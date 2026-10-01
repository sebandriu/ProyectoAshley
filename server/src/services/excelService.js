import ExcelJS from "exceljs";

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("result" in value) {
      return normalizeCellValue(value.result);
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }

    if ("text" in value) {
      return value.text;
    }

    return JSON.parse(JSON.stringify(value));
  }

  return value;
}

function detectReportType(headers) {
  const normalized = new Set(headers.map(normalizeHeader));

  const has = (...names) =>
    names.some((name) => normalized.has(normalizeHeader(name)));

  const isOffer =
    has("N° Oferta", "N Oferta") &&
    has("Fecha") &&
    has("Código", "Codigo") &&
    has("Cantidad");

  const isSales =
    has("TipoDoc") &&
    has("NumeroDoc") &&
    has("Fecha") &&
    has("ItemCode") &&
    has("Cantidad");

  if (isOffer) return "OF";
  if (isSales) return "VENTAS";

  return null;
}

export async function readSapWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("El archivo Excel no contiene hojas.");
  }

  const headerRow = worksheet.getRow(1);
  const headers = [];

  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    const rawHeader = normalizeCellValue(headerRow.getCell(column).value);
    headers.push(String(rawHeader ?? "").trim());
  }

  if (!headers.some(Boolean)) {
    throw new Error("No fue posible identificar los encabezados del archivo.");
  }

  const tipoInforme = detectReportType(headers);

  if (!tipoInforme) {
    throw new Error(
      "El archivo no coincide con los formatos de OF o VENTAS esperados por Micapp."
    );
  }

  const rows = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const data = {};
    let hasData = false;

    headers.forEach((header, index) => {
      if (!header) return;

      const value = normalizeCellValue(row.getCell(index + 1).value);

      if (value !== null && value !== "") {
        hasData = true;
      }

      data[header] = value;
    });

    if (hasData) {
      rows.push({
        rowNumber,
        data,
      });
    }
  }

  if (rows.length === 0) {
    throw new Error("El archivo no contiene filas de datos.");
  }

  return {
    tipoInforme,
    headers,
    rows,
    worksheetName: worksheet.name,
  };
}
