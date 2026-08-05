import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import FloatingAssistant from "@/components/FloatingAssistant";
import { PageContextProvider } from "@/lib/page-context";
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Başlık serifi — Oxford karakteri buradan geliyor.
 *
 * apple-design "sistem fontunu geç, ancak sebebin varsa" diyor; akademik
 * karakter geçerli bir sebep. Ama YALNIZCA başlıklarda: gövde metni
 * ekranda okunurluk için sans kalıyor.
 *
 * Newsreader ekran için tasarlanmış editoryal bir serif ve optik boyut
 * (optical sizing) destekliyor — harf biçimi boyuta göre değişiyor,
 * ki tipografi bölümünün istediği tam bu.
 */
const newsreader = Newsreader({
  variable: "--font-serif-display",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hukuk Çalışma",
  description: "Kişisel hukuk sınav hazırlık platformu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hukuk",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Tema ilk boyamadan ÖNCE uygulanmalı, yoksa yanlış temada bir
            kare görünür (FOUC) ve karanlıkta beyaz flaş göze vurur. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('hmgs_tema')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.classList.add('theme-ready');}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-primary/30">
        <PageContextProvider>
          {children}
          <FloatingAssistant />
        </PageContextProvider>
      </body>
    </html>
  );
}
