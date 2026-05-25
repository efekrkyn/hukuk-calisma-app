"use client";
import { pdfjs } from "react-pdf";

// PDF.js worker'ı public/ altından serve ediyoruz (vendored from pdfjs-dist).
// CDN dependency yok, offline çalışır.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
