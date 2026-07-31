const Api = {
  async search(query) {
    const res = await fetch(`${API_BASE_URL}/diseases/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  },

  async getDisease(slug, audience, lang) {
    const res = await fetch(
      `${API_BASE_URL}/diseases/${encodeURIComponent(slug)}?audience=${audience}&lang=${lang}`
    );
    if (!res.ok) throw new Error("Could not load disease");
    return res.json();
  },
};
