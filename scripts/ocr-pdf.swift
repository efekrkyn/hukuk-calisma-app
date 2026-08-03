// Taranmış PDF'leri macOS Vision ile OCR eder.
//
// Korpustaki 38 PDF'in metni çıkarılamıyor (İş Hukuku notlarının neredeyse
// tamamı dahil), bu yüzden RAG onlardan cevap veremiyor. tesseract/poppler
// kurulu değil; macOS'un kendi Vision motoru Türkçe destekliyor ve
// Xcode CLT dışında bir şey gerektirmiyor.
//
// Kullanım:  swift ocr-pdf.swift <pdf-yolu> [dpi]
// Çıktı   :  stdout'a JSON  [{"page":1,"text":"..."}]

import Foundation
import PDFKit
import Vision
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("kullanım: swift ocr-pdf.swift <pdf> [dpi]\n".data(using: .utf8)!)
    exit(2)
}
let path = args[1]
let dpi = args.count >= 3 ? (Double(args[2]) ?? 200) : 200
let scale = dpi / 72.0
// 4. argüman: yalnızca ilk N sayfa (önizleme için — tam OCR saatler sürüyor)
let maxPages = args.count >= 4 ? (Int(args[3]) ?? 0) : 0

guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
    FileHandle.standardError.write("PDF açılamadı: \(path)\n".data(using: .utf8)!)
    exit(1)
}

/// Vision'ın desteklediği diller cihaza göre değişiyor; tr yoksa sessizce
/// İngilizceye düşmek yerine elde olanı kullan.
func preferredLanguages() -> [String] {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    let supported = (try? req.supportedRecognitionLanguages()) ?? []
    var langs: [String] = []
    for want in ["tr-TR", "tr"] where supported.contains(want) {
        langs.append(want)
        break
    }
    if supported.contains("en-US") { langs.append("en-US") }
    return langs.isEmpty ? supported : langs
}

var lastConfidence: Double = 0
let languages = preferredLanguages()
FileHandle.standardError.write("diller: \(languages.joined(separator: ","))\n".data(using: .utf8)!)

func ocr(_ image: CGImage) -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = languages

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        return ""
    }
    let obs = request.results ?? []
    var confs: [Float] = []
    let lines = obs.compactMap { o -> String? in
        guard let c = o.topCandidates(1).first else { return nil }
        confs.append(c.confidence)
        return c.string
    }
    lastConfidence = confs.isEmpty ? 0 : Double(confs.reduce(0, +)) / Double(confs.count)
    return lines.joined(separator: "\n")
}

var pages: [[String: Any]] = []
let limit = maxPages > 0 ? min(maxPages, doc.pageCount) : doc.pageCount
for i in 0..<limit {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let w = Int(bounds.width * scale)
    let h = Int(bounds.height * scale)
    guard w > 0, h > 0,
          let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceGray(),
                              bitmapInfo: CGImageAlphaInfo.none.rawValue)
    else { continue }

    ctx.setFillColor(CGColor(gray: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)

    guard let img = ctx.makeImage() else { continue }
    let text = ocr(img)
    pages.append(["page": i + 1, "text": text, "confidence": lastConfidence])

    if (i + 1) % 10 == 0 {
        FileHandle.standardError.write("  \(i + 1)/\(limit)\n".data(using: .utf8)!)
    }
}

let data = try JSONSerialization.data(withJSONObject: pages, options: [])
FileHandle.standardOutput.write(data)
