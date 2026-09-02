export default function CVInput({ cvText, setCvText, onAnalyze, loading, error }) {
  return (
    <section className="card">
      <h2>1. Pega tu CV</h2>
      <p className="muted">
        Pega el texto completo de tu CV. Analizamos qué tan bien encajas con distintos roles — nada se guarda en un servidor, solo vive en esta sesión.
      </p>
      <textarea
        value={cvText}
        onChange={(e) => setCvText(e.target.value)}
        placeholder="Pega aquí el texto de tu CV..."
        rows={12}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={onAnalyze} disabled={loading || !cvText.trim()}>
        {loading ? "Analizando..." : "Analizar mi CV"}
      </button>
    </section>
  );
}
