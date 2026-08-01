export async function searchWeb(query: string, apiKey?: string): Promise<string> {
  if (!apiKey) {
    return "TAVILY_API_KEY bulunamadı, internet araması devre dışı.";
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: true,
        max_results: 3
      })
    });
    
    if (!res.ok) {
      const err = await res.text();
      console.error(`Tavily search failed: ${res.status}`, err);
      return "İnternet araması sırasında bir hata oluştu.";
    }

    const data: any = await res.json();
    
    const snippets: string[] = [];
    if (data.answer) {
      snippets.push(`Özet Yanıt: ${data.answer}`);
    }
    
    if (data.results && Array.isArray(data.results)) {
      for (const r of data.results) {
        snippets.push(`- [${r.title}](${r.url}): ${r.content}`);
      }
    }
    
    if (snippets.length === 0) {
      return "İnternette kayda değer bir sonuç bulunamadı.";
    }

    return "İnternet Arama Sonuçları:\n\n" + snippets.join("\n\n");
  } catch (e) {
    console.error("Web search error:", e);
    return "İnternet araması sırasında bir hata oluştu.";
  }
}
