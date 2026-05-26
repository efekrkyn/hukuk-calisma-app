"use client";

import { useState, useEffect, useRef } from "react";
import { BookA, Search, X } from "lucide-react";
import sozlukData from "@/data/sozluk.json";

export default function FloatingDictionary() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = sozlukData.filter(
    (item) =>
      item.term.toLowerCase().includes(query.toLowerCase()) ||
      item.meaning.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Search Panel */}
      <div
        className={`pointer-events-auto mb-4 bg-background/80 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen ? "opacity-100 scale-100 w-[300px] sm:w-[350px] max-h-[400px] flex flex-col" : "opacity-0 scale-95 w-0 h-0 pointer-events-none"
        }`}
      >
        <div className="p-3 border-b border-border/50 flex items-center gap-2 bg-muted/30">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Terim ara (Örn: Muvazaa)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm focus:outline-none placeholder:text-muted-foreground/50"
          />
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted rounded-md text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
          {filtered.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">Sonuç bulunamadı.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((item, i) => (
                <div key={i} className="p-2 hover:bg-primary/5 rounded-lg transition-colors group cursor-default">
                  <h4 className="text-sm font-semibold text-primary/80 group-hover:text-primary transition-colors">{item.term}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.meaning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Button (Dynamic Island Style) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto group flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-xl hover:shadow-primary/30 transition-all hover:scale-105 active:scale-95"
      >
        <BookA className="w-5 h-5" />
        <span className="text-sm font-medium pr-1">Sözlük</span>
      </button>
    </div>
  );
}
