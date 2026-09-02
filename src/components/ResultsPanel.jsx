function CopyBlock({ label, text }) {
  const copy = () => navigator.clipboard?.writeText(text);
  return (
    <div className="results-block">
      <div className="results-block-header">
        <h3>{label}</h3>
        <button className="btn-secondary" onClick={copy}>
          Copiar
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

export default function ResultsPanel({ vacancy, adaptedCV, coverLetter, loading, error }) {
  if (!vacancy) return null;
  return (
    <section className="card">
      <h2>4. Material para "{vacancy.title}"</h2>
      {loading && <p className="muted">Generando CV adaptado y carta de presentación...</p>}
      {error && <p className="error">{error}</p>}
      {adaptedCV && <CopyBlock label="CV adaptado" text={adaptedCV} />}
      {coverLetter && <CopyBlock label="Carta de presentación" text={coverLetter} />}
      {(adaptedCV || coverLetter) && (
        <a href={vacancy.url} target="_blank" rel="noreferrer noopener" className="btn-secondary">
          Ir a aplicar en {vacancy.platform} ↗
        </a>
      )}
    </section>
  );
}
