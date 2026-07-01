import path from "node:path";
import { fileURLToPath } from "node:url";

export const FONT = {
  serif: "QF-Serif",
  sans: "QF-Sans",
  script: "QF-Script",
} as const;

const fontsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fonts"
);

export function registerPdfFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(
    FONT.serif,
    path.join(fontsDir, "PlayfairDisplay-Regular.ttf")
  );
  doc.registerFont(FONT.sans, path.join(fontsDir, "Inter.ttf"));
  doc.registerFont(
    FONT.script,
    path.join(fontsDir, "DancingScript-Regular.ttf")
  );
}

export type PdfDoc = PDFKit.PDFDocument;
