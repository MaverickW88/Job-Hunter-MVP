import { useState } from "react";
import { api } from "./api.js";
import CVInput from "./components/CVInput.jsx";
import RolesFit from "./components/RolesFit.jsx";
import VacancyList from "./components/VacancyList.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";

export default function App() {
  const [cvText, setCvText] = useState("");
  const [roles, setRoles] = useState(null);
  const [vacancies, setVacancies] = useState(null);
  const [selectedVacancy, setSelectedVacancy] = useState(null);
  const [adaptedCV, setAdaptedCV] = useState("");
  const [coverLetter, setCoverLetter] = useState("");

  const [loadingStep, setLoadingStep] = useState(null); // "analyze" | "search" | "generate" | null
  const [errors, setErrors] = useState({});

  async function handleAnalyze() {
    setLoadingStep("analyze");
    setErrors((e) => ({ ...e, analyze: null }));
    setRoles(null);
    setVacancies(null);
    try {
      const { roles } = await api.analyzeCV(cvText);
      setRoles(roles);
    } catch (e) {
      setErrors((prev) => ({ ...prev, analyze: e.message }));
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleSearchVacancies() {
    setLoadingStep("search");
    setErrors((e) => ({ ...e, search: null }));
    setVacancies(null);
    try {
      const roleNames = (roles || []).map((r) => r.role);
      const { vacancies } = await api.searchVacancies(cvText, roleNames);
      setVacancies(vacancies);
    } catch (e) {
      setErrors((prev) => ({ ...prev, search: e.message }));
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleGenerate(vacancy) {
    setSelectedVacancy(vacancy);
    setLoadingStep("generate");
    setErrors((e) => ({ ...e, generate: null }));
    setAdaptedCV("");
    setCoverLetter("");
    try {
      const [adapted, letter] = await Promise.all([
        api.adaptCV(cvText, vacancy),
        api.generateCoverLetter(cvText, vacancy),
      ]);
      setAdaptedCV(adapted.adaptedCV);
      setCoverLetter(letter.coverLetter);
    } catch (e) {
      setErrors((prev) => ({ ...prev, generate: e.message }));
    } finally {
      setLoadingStep(null);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Job.hunter()</h1>
        <p className="muted">Analiza tu CV, encuentra vacantes reales en México y prepárate para aplicar — en minutos.</p>
      </header>

      <CVInput
        cvText={cvText}
        setCvText={setCvText}
        onAnalyze={handleAnalyze}
        loading={loadingStep === "analyze"}
        error={errors.analyze}
      />

      <RolesFit
        roles={roles}
        onSearchVacancies={handleSearchVacancies}
        loading={loadingStep === "search"}
        error={errors.search}
      />

      <VacancyList
        vacancies={vacancies}
        onGenerate={handleGenerate}
        activeVacancyUrl={selectedVacancy?.url}
        loading={loadingStep === "generate"}
        error={errors.generate}
      />

      <ResultsPanel
        vacancy={selectedVacancy}
        adaptedCV={adaptedCV}
        coverLetter={coverLetter}
        loading={loadingStep === "generate"}
        error={null}
      />

      <footer className="app-footer">
        <p className="muted">
          MVP — proyecto personal de Humberto Guzmán. Ninguna vacante es inventada: se busca en la web en tiempo real.
        </p>
      </footer>
    </div>
  );
}
