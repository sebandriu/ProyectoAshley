import ExcelJS from "exceljs";

const CONSOLIDATED_ORIGINS = new Set(["OF", "FR", "FD"]);

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

function shouldIgnoreHeader(header) {
  const normalized = normalizeHeader(header);
  return !normalized || normalized === "#";
}

function findHeader(headers, ...aliases) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));

  return headers.find(
    (header) =>
      !shouldIgnoreHeader(header) &&
      normalizedAliases.has(normalizeHeader(header))
  );
}

function detectReportType(headers) {
  const has = (...aliases) => Boolean(findHeader(headers, ...aliases));

  const isConsolidated =
    has("OrigenMicapp") &&
    has("Número interno", "Numero interno", "DocEntry") &&
    has("N° Documento", "N Documento", "Numero Documento") &&
    has("Fecha") &&
    has("Código", "Codigo", "ItemCode") &&
    has("Cantidad");

  if (isConsolidated) return "CONSOLIDADO";

  const isOffer =
    has("N° Oferta", "N Oferta") &&
    has("Fecha") &&
    has("Código", "Codigo") &&
    has("Cantidad");

  if (isOffer) return "OF";

  const isSales =
    has("TipoDoc") &&
    has("NumeroDoc") &&
    has("Fecha") &&
    has("ItemCode") &&
    has("Cantidad");

  if (isSales) return "VENTAS";

  return null;
}

function normalizeValueForHeader(header, value) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedValue = normalizeCellValue(value);

  if (
    normalizedValue !== null &&
    ["codigo", "itemcode"].includes(normalizedHeader)
  ) {
    return String(normalizedValue);
  }

  return normalizedValue;
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

  const usableHeaders = headers.filter((header) => !shouldIgnoreHeader(header));

  if (usableHeaders.length === 0) {
    throw new Error("No fue posible identificar los encabezados del archivo.");
  }

  const tipoInforme = detectReportType(headers);

  if (!tipoInforme) {
    throw new Error(
      "El archivo no coincide con los formatos reconocidos por Micapp."
    );
  }

  const originHeader =
    tipoInforme === "CONSOLIDADO" ? findHeader(headers, "OrigenMicapp") : null;

  const originCounts = {
    OF: 0,
    FR: 0,
    FD: 0,
  };

  const rows = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const data = {};
    let hasData = false;

    headers.forEach((header, index) => {
      if (shouldIgnoreHeader(header)) return;

      const value = normalizeValueForHeader(
        header,
        row.getCell(index + 1).value
      );

      if (value !== null && value !== "") {
        hasData = true;
      }

      data[header] = value;
    });

    if (!hasData) continue;

    if (tipoInforme === "CONSOLIDADO") {
      const origin = String(data[originHeader] ?? "")
        .trim()
        .toUpperCase();

      if (!CONSOLIDATED_ORIGINS.has(origin)) {
        throw new Error(
          `La fila ${rowNumber} tiene un OrigenMicapp inválido: "${origin || "(vacío)"}".`
        );
      }

      data[originHeader] = origin;
      originCounts[origin] += 1;
    }

    rows.push({
      rowNumber,
      data,
    });
  }

  if (rows.length === 0) {
    throw new Error("El archivo no contiene filas de datos.");
  }

  return {
    tipoInforme,
    headers: usableHeaders,
    rows,
    worksheetName: worksheet.name,
    originCounts,
    ignoredColumns: headers.filter(shouldIgnoreHeader).length,
  };
}
