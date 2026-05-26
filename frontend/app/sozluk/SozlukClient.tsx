"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

type Term = {
  term: string;
  origin: string;
  definition: string;
};
import sozlukData from "@/data/sozluk.json";

export default function SozlukClient() {
  const [search, setSearch] = useState("");

  const TERMS = useMemo(() => {
    return sozlukData.map(item => ({
      term: item.term,
      origin: "Hukuk",
      definition: item.meaning
    }));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return TERMS;
    const q = search.toLowerCase();
    return TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.origin.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
    );
  }, [search, TERMS]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Terim, kavram veya Latince ifade ara..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background text-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} terim bulundu</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((t) => (
          <Card key={t.term} className="glass border-primary/10 hover-glow transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="text-gradient font-bold">{t.term}</span>
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{t.origin}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">"{search}" için sonuç bulunamadı.</p>
          <p className="text-sm mt-1">Farklı bir terim aramayı deneyin.</p>
        </div>
      )}
    </div>
  );
}
