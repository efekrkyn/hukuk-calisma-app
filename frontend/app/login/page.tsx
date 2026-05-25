"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, AlertCircle, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await loginAction(password);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else if (res.success && res.token) {
        // Save to localStorage for API calls to the Worker
        localStorage.setItem("auth_token", res.token);
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError("Bağlantı hatası oluştu.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-radial from-slate-900 via-zinc-950 to-black min-h-screen relative overflow-hidden">
      {/* Background abstract elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

      <Card className="w-full max-w-md bg-zinc-950/40 backdrop-blur-xl border border-zinc-800/60 shadow-2xl relative">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div
            data-slot="card-title"
            className="font-heading group-data-[size=sm]/card:text-sm text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent"
          >
            İrem'in Hukuk Uygulaması
          </div>
          <div data-slot="card-description" className="text-zinc-400 text-xs mt-1">
            Bu uygulama İrem Türk için sevgilisi Efe Karakoyun tarafından yapılmıştır
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <Input
                  type="password"
                  placeholder="Giriş Şifresi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-zinc-900/40 border-zinc-800/80 focus-visible:ring-primary/40 focus-visible:border-primary/50 text-center tracking-widest text-sm rounded-xl h-10"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs transition-all duration-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full rounded-xl h-10 font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
            >
              {loading ? "Giriş Yapılıyor..." : (
                <>
                  Giriş Yap
                  <Sparkles className="w-4 h-4 text-primary/80" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
