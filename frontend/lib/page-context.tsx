"use client";

/**
 * Sayfa bağlamı — yüzen asistanın "neredeyim, ne yapıyorum" bilgisi.
 *
 * Asistan sayfadan bağımsız yaşadığı için hangi soruyu çözdüğümüzü kendi
 * başına bilemez. Sayfalar bulundukları bağlamı buraya yayınlar, asistan
 * okur ve soruya cevap verirken kullanır ("bu nedir?" dediğinde neyi
 * kastettiğini bilir).
 *
 * `detail` modele gider, `label` baloncukta görünür.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageContextValue = {
  /** Baloncukta görünen kısa etiket — ör. "Soru 3" */
  label: string;
  /** Modele gönderilecek tam bağlam — soru metni, şıklar, alan */
  detail?: string;
};

type Store = {
  ctx: PageContextValue | null;
  setCtx: (v: PageContextValue | null) => void;
};

const Ctx = createContext<Store>({ ctx: null, setCtx: () => {} });

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<PageContextValue | null>(null);
  const value = useMemo(() => ({ ctx, setCtx }), [ctx]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageContext() {
  return useContext(Ctx).ctx;
}

/**
 * Sayfa bağlamını yayınlar; bileşen kaldırılınca temizler.
 * Temizlik şart — yoksa sınavdan çıkıldığında asistan hâlâ o soruyu
 * konuşuyor sanır.
 */
export function useSetPageContext(value: PageContextValue | null) {
  const { setCtx } = useContext(Ctx);
  const label = value?.label ?? "";
  const detail = value?.detail ?? "";

  useEffect(() => {
    setCtx(label ? { label, detail } : null);
    return () => setCtx(null);
  }, [label, detail, setCtx]);
}
