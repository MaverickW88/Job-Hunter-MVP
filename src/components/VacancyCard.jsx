export default function VacancyCard({ vacancy, onGenerate, isActive, loading }) {
  return (
    <li className={`vacancy-card ${isActive ? "active" : ""}`}>
      <div className="vacancy-card-top">
        <div>
          <strong>{vacancy.title}</strong>
          <p className="muted">
            {vacancy.company} · {vacancy.platform}
          </p>
        </div>
        <span className="fit-pill">{vacancy.fitPercent}% fit</span>
      </div>
      {vacancy.whyFit && <p className="muted">{vacancy.whyFit}</p>}
      <div className="vacancy-card-actions">
        <a href={vacancy.url} target="_blank" rel="noreferrer noopener" className="btn-secondary">
          Ver vacante y aplicar ↗
        </a>
        <button onClick={() => onGenerate(vacancy)} disabled={loading}>
          {isActive && loading ? "Generando..." : "Adaptar CV + carta para esta"}
        </button>
      </div>
    </li>
  );
}
