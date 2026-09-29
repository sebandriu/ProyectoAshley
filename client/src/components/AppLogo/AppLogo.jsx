function AppLogo({ compact = false }) {
  return (
    <div className={`app-logo ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 100 100"
        className="app-logo-icon"
        aria-label="Micapp logo"
      >
        <path
          d="M20 72 V42 L50 14 L80 42 V72 H20 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinejoin="round"
        />
      </svg>

      {!compact && (
        <div className="app-logo-text">
          <strong>Micapp</strong>
          <span>Marcela Icaza</span>
        </div>
      )}
    </div>
  );
}

export default AppLogo;