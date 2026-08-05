"use client";

/**
 * Tema — sistemi takip eder, istenirse elle geçilir.
 *
 * Uygulama koyuya sabitlenmişti. Ama doğru tema ortama bağlı: aydınlık
 * odada koyu tema okumayı zorlaştırır, gece açık tema göz kamaştırır.
 * Sağlıklı olan sabit bir palet değil, ortama uyan palet.
 *
 * Kullanıcı yine de üzerine yazabilmeli (apple-design "Agency"): seçim
 * yapılırsa o kalıcı, yapılmazsa sistem takip edilir.
 */

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Mode = "light" | "dark" | "system";
const KEY = "hmgs_tema";

export function applyTheme(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Mode) || "system";
    setMode(saved);
    applyTheme(saved);

    // Sistem teması değişirse (gün batımı, odaklama modu) takip et —
    // ama yalnızca kullanıcı elle bir seçim yapmadıysa.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) as Mode) === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function pick(m: Mode) {
    setMode(m);
    localStorage.setItem(KEY, m);
    applyTheme(m);
  }

  const items: Array<{ m: Mode; icon: typeof Sun; label: string }> = [
    { m: "light", icon: Sun, label: "Açık" },
    { m: "system", icon: Monitor, label: "Sistem" },
    { m: "dark", icon: Moon, label: "Koyu" },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full material-thin p-0.5">
      {items.map(({ m, icon: Icon, label }) => (
        <button
          key={m}
          onClick={() => pick(m)}
          aria-label={`${label} tema`}
          aria-pressed={mode === m}
          className={
            "grid place-items-center h-7 w-7 rounded-full transition-colors " +
            (mode === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
