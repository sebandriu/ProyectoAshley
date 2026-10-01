import { useRef, useState } from "react";

import { importSapFile } from "../../services/api";

function Importacion() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function handleSelectClick() {
    inputRef.current?.click();
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setResult(null);
    setError("");
    setStatus("idle");
  }

  async function handleImport() {
    if (!file) return;

    setStatus("uploading");
    setError("");
    setResult(null);

    try {
      const response = await importSapFile(file);
      setResult(response);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <h2>Importar información desde SAP</h2>

        <div className="upload-area">
          <strong>Seleccionar archivo Excel</strong>

          <span>
            Archivo .xlsx generado desde la consulta consolidada de Micapp
          </span>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            hidden
          />

          <button
            type="button"
            onClick={handleSelectClick}
            disabled={status === "uploading"}
          >
            Seleccionar archivo
          </button>

          {file && (
            <>
              <span>
                Archivo seleccionado: <strong>{file.name}</strong>
              </span>

              <button
                type="button"
                onClick={handleImport}
                disabled={status === "uploading"}
              >
                {status === "uploading"
                  ? "Importando..."
                  : "Importar archivo"}
              </button>
            </>
          )}

          {status === "success" && result && (
            <div>
              <strong>Importación completada</strong>
              <p>Tipo detectado: {result.tipoInforme}</p>
              <p>Filas procesadas: {result.filasProcesadas}</p>

              {result.tipoInforme === "CONSOLIDADO" && (
                <>
                  <p>OF: {result.origenes?.OF ?? 0}</p>
                  <p>FR: {result.origenes?.FR ?? 0}</p>
                  <p>FD: {result.origenes?.FD ?? 0}</p>
                </>
              )}

              <p>Hoja: {result.hoja}</p>
              <p>ID de importación: {result.importacionId}</p>
            </div>
          )}

          {status === "error" && (
            <div>
              <strong>No fue posible importar el archivo</strong>
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Importacion;
