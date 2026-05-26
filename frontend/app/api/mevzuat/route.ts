import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const response = await fetch("https://www.resmigazete.gov.tr/rss.xml", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Resmi Gazete RSS failed: ${response.status}`);
      return NextResponse.json(
        { error: `Resmi Gazete'ye ulaşılamadı (HTTP ${response.status})` },
        { status: 500 }
      );
    }

    const text = await response.text();

    const items: Array<{
      title: string;
      link: string;
      pubDate: string;
      description: string;
    }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const itemText = match[1];
      const titleMatch =
        /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(itemText) ||
        /<title>(.*?)<\/title>/.exec(itemText);
      const linkMatch = /<link>(.*?)<\/link>/.exec(itemText);
      const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemText);
      const descMatch =
        /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(
          itemText
        ) || /<description>([\s\S]*?)<\/description>/.exec(itemText);

      items.push({
        title: titleMatch ? titleMatch[1].trim() : "",
        link: linkMatch ? linkMatch[1].trim() : "",
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
        description: descMatch ? descMatch[1].trim() : "",
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("RSS fetch error:", error);
    return NextResponse.json(
      { error: "RSS okunurken hata oluştu" },
      { status: 500 }
    );
  }
}
