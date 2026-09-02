async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status} llamando a ${path}`);
  }
  return data;
}

export const api = {
  analyzeCV: (cvText) => post("/api/analyze-cv", { cvText }),
  searchVacancies: (cvText, roles) => post("/api/search-vacancies", { cvText, roles }),
  adaptCV: (cvText, vacancy) => post("/api/adapt-cv", { cvText, vacancy }),
  generateCoverLetter: (cvText, vacancy) => post("/api/generate-cover-letter", { cvText, vacancy }),
};
