function FitBar({ percent }) {
  return (
    <div className="fit-bar" aria-label={`Fit ${percent}%`}>
      <div className="fit-bar-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      <span className="fit-bar-label">{percent}%</span>
    </div>
  );
}

export default function RolesFit({ roles, onSearchVacancies, loading, error }) {
  if (!roles?.length) return null;
  return (
    <section className="card">
      <h2>2. Tus roles con mejor fit</h2>
      <ul className="roles-list">
        {roles.map((r, i) => (
          <li key={i}>
            <div className="roles-list-header">
              <strong>{r.role}</strong>
              <FitBar percent={r.fitPercent} />
            </div>
            <p className="muted">{r.rationale}</p>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
      <button onClick={onSearchVacancies} disabled={loading}>
        {loading ? "Buscando vacantes reales..." : "Buscar mis 10 vacantes reales"}
      </button>
    </section>
  );
}
