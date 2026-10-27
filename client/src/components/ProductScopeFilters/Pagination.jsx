function Pagination({ data, onChange }) {
  if (!data || data.paginas <= 1) return null;
  const { pagina, paginas, total, porPagina } = data;
  const from = (pagina - 1) * porPagina + 1;
  const to = Math.min(total, pagina * porPagina);

  return (
    <nav className="module-pagination" aria-label="Navegación de documentos">
      <span>Documentos {from}–{to} de {total}</span>
      <div>
        <button type="button" onClick={() => onChange(pagina - 1)} disabled={pagina <= 1}>
          Anterior
        </button>
        <strong>Página {pagina} de {paginas}</strong>
        <button type="button" onClick={() => onChange(pagina + 1)} disabled={pagina >= paginas}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
