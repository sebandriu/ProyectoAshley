function Importacion() {
  return (
    <div className="page">
      <div className="panel">
        <h2>Importar información desde SAP</h2>

        <div className="upload-area">
          <strong>Seleccionar archivo Excel</strong>

          <span>
            Archivos .xlsx exportados desde SAP Business One
          </span>

          <button type="button">
            Seleccionar archivo
          </button>
        </div>
      </div>
    </div>
  );
}

export default Importacion;