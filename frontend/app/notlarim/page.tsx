"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, StickyNote, Plus, Trash2, Search, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Note = {
  id: string;
  title: string;
  content: string;
  articles: string[]; // Kanun maddeleri (Örn: "TBK m.49")
  createdAt: string;
};

export default function NotlarimPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newArticles, setNewArticles] = useState("");

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hukuk_notlarim");
    if (saved) {
      try { setNotes(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("hukuk_notlarim", JSON.stringify(notes));
  }, [notes]);

  const addNote = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const articles = newArticles.split(",").map((a) => a.trim()).filter(Boolean);
    setNotes((prev) => [
      {
        id: crypto.randomUUID(),
        title: newTitle,
        content: newContent,
        articles,
        createdAt: new Date().toISOString().split("T")[0],
      },
      ...prev,
    ]);
    setNewTitle("");
    setNewContent("");
    setNewArticles("");
    setShowForm(false);
  };

  const removeNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.articles.some((a) => a.toLowerCase().includes(q))
    );
  });

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Ana sayfa
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gradient">
              <StickyNote className="w-8 h-8 text-primary" />
              Madde Bağlantılı Notlarım
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Notlarını kanun maddeleriyle ilişkilendir, istediğin zaman ara.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="hover-glow">
            <Plus className="w-4 h-4 mr-1" /> Yeni Not
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Not, kavram veya kanun maddesi ara (Örn: TBK m.49)..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background text-sm"
          />
        </div>

        {/* Form */}
        {showForm && (
          <Card className="glass border-primary/20 animate-in slide-in-from-top-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Yeni Not Ekle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Başlık (Örn: Haksız Fiil Unsurları)"
                className="w-full p-2 border rounded-md bg-background text-sm"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Not içeriği..."
                className="w-full h-32 p-3 border rounded-md bg-background text-sm resize-none"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> İlişkili Kanun Maddeleri (virgülle ayır)
                </label>
                <input
                  type="text"
                  value={newArticles}
                  onChange={(e) => setNewArticles(e.target.value)}
                  placeholder="TBK m.49, TBK m.50, TMK m.2"
                  className="w-full p-2 border rounded-md bg-background text-sm"
                />
              </div>
              <Button onClick={addNote} disabled={!newTitle.trim() || !newContent.trim()} className="w-full hover-glow">
                Notu Kaydet
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notes list */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="text-center py-16 glass rounded-2xl border border-border">
              <StickyNote className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-medium">{notes.length === 0 ? "Henüz not eklenmemiş" : "Arama sonucu bulunamadı"}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {notes.length === 0 ? "Yukarıdaki 'Yeni Not' butonuna tıklayarak başla." : "Farklı bir terim deneyin."}
              </p>
            </div>
          )}

          {filtered.map((note) => (
            <Card key={note.id} className="glass border-primary/10 hover-glow transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg text-gradient">{note.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{note.createdAt}</p>
                  </div>
                  <button onClick={() => removeNote(note.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{note.content}</p>
                {note.articles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {note.articles.map((article) => (
                      <Link
                        key={article}
                        href={`/kanunlar?q=${encodeURIComponent(article)}`}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" /> {article}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
