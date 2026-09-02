import VacancyCard from "./VacancyCard.jsx";

export default function VacancyList({ vacancies, onGenerate, activeVacancyUrl, loading, error }) {
  if (!vacancies) return null;
  return (
    <section className="card">
      <h2>3. Tus vacantes reales</h2>
      {vacancies.length === 0 && (
        <p className="muted">
          No encontramos vacantes verificables esta vez — el motor solo devuelve vacantes reales, nunca inventadas. Intenta de nuevo o ajusta tu CV.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="vacancy-list">
        {vacancies.map((v, i) => (
          <VacancyCard
            key={v.url || i}
            vacancy={v}
            onGenerate={onGenerate}
            isActive={activeVacancyUrl === v.url}
            loading={loading}
          />
        ))}
      </ul>
    </section>
  );
}
