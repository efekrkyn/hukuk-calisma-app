import { Hono } from "hono";

export const mevzuat = new Hono();

// https://www.resmigazete.gov.tr/rss.xml
mevzuat.get("/rss", async (c) => {
  try {
    const response = await fetch("https://www.resmigazete.gov.tr/rss.xml");
    if (!response.ok) {
      return c.json({ error: "Resmi Gazete'ye ulaşılamadı" }, 500);
    }
    const text = await response.text();
    
    // Basit XML parse (Cloudflare worker'da DOMParser vs. olmadığı için regex ile temel kısımları alıyoruz)
    const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(text)) !== null) {
      const itemText = match[1];
      const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(itemText) || /<title>(.*?)<\/title>/.exec(itemText);
      const linkMatch = /<link>(.*?)<\/link>/.exec(itemText);
      const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemText);
      const descMatch = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(itemText) || /<description>([\s\S]*?)<\/description>/.exec(itemText);
      
      items.push({
        title: titleMatch ? titleMatch[1].trim() : "",
        link: linkMatch ? linkMatch[1].trim() : "",
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
        description: descMatch ? descMatch[1].trim() : ""
      });
    }

    return c.json({ items });
  } catch (error) {
    return c.json({ error: "RSS okunurken hata oluştu" }, 500);
  }
});
