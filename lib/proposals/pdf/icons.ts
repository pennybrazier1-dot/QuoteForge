import { PDF_COLORS } from "@/lib/proposals/pdf/tokens";
import type { PdfDoc } from "@/lib/proposals/pdf/fonts";

const STROKE = 0.65;

function circle(doc: PdfDoc, cx: number, cy: number, r: number) {
  doc.circle(cx, cy, r).lineWidth(STROKE).strokeColor(PDF_COLORS.orange).stroke();
}

export function iconPound(doc: PdfDoc, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 1;
  doc.circle(cx, cy, r).fillColor(PDF_COLORS.orange).fill();
  doc
    .font("QF-Serif")
    .fontSize(size * 0.36)
    .fillColor(PDF_COLORS.white)
    .text("£", x + size * 0.31, y + size * 0.28, { lineBreak: false });
}

export function iconCalendar(doc: PdfDoc, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 1;
  doc.circle(cx, cy, r).fillColor(PDF_COLORS.orange).fill();
  const ix = x + size * 0.3;
  const iy = y + size * 0.32;
  const iw = size * 0.4;
  const ih = size * 0.34;
  doc
    .rect(ix, iy, iw, ih)
    .lineWidth(STROKE)
    .strokeColor(PDF_COLORS.white)
    .stroke();
  doc
    .moveTo(ix, iy + ih * 0.3)
    .lineTo(ix + iw, iy + ih * 0.3)
    .strokeColor(PDF_COLORS.white)
    .stroke();
}

export function iconPerson(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  const cx = x + size / 2;
  const cy = y + size / 2;
  doc.circle(cx, cy - size * 0.1, size * 0.09).stroke();
  doc
    .moveTo(cx - size * 0.16, cy + size * 0.26)
    .bezierCurveTo(
      cx - size * 0.16,
      cy + size * 0.1,
      cx + size * 0.16,
      cy + size * 0.1,
      cx + size * 0.16,
      cy + size * 0.26
    )
    .stroke();
}

export function iconPersonFilled(doc: PdfDoc, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 1;
  doc.circle(cx, cy, r).fillColor(PDF_COLORS.orange).fill();
  doc.lineWidth(STROKE).strokeColor(PDF_COLORS.white);
  doc.circle(cx, cy - size * 0.1, size * 0.09).stroke();
  doc
    .moveTo(cx - size * 0.16, cy + size * 0.26)
    .bezierCurveTo(
      cx - size * 0.16,
      cy + size * 0.1,
      cx + size * 0.16,
      cy + size * 0.1,
      cx + size * 0.16,
      cy + size * 0.26
    )
    .stroke();
}

export function iconClipboard(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  const ix = x + size * 0.32;
  const iy = y + size * 0.3;
  doc.rect(ix, iy, size * 0.36, size * 0.38).stroke();
  doc.rect(ix + size * 0.1, iy - size * 0.07, size * 0.16, size * 0.08).stroke();
}

export function iconBricks(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  const ix = x + size * 0.3;
  const iy = y + size * 0.36;
  const bw = size * 0.16;
  const bh = size * 0.08;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      doc
        .rect(ix + col * (bw + 2) + (row % 2 ? bw / 2 : 0), iy + row * (bh + 2), bw, bh)
        .stroke();
    }
  }
}

export function iconInfo(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  doc
    .font("QF-Sans")
    .fontSize(size * 0.38)
    .fillColor(PDF_COLORS.orange)
    .text("i", x + size * 0.42, y + size * 0.28, { lineBreak: false });
}

export function iconStar(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  doc
    .font("QF-Sans")
    .fontSize(size * 0.34)
    .fillColor(PDF_COLORS.orange)
    .text("✦", x + size * 0.32, y + size * 0.3, { lineBreak: false });
}

export function iconDocument(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  const ix = x + size * 0.34;
  const iy = y + size * 0.3;
  doc.rect(ix, iy, size * 0.32, size * 0.4).stroke();
  doc.moveTo(ix + size * 0.07, iy + size * 0.12).lineTo(ix + size * 0.25, iy + size * 0.12).stroke();
  doc.moveTo(ix + size * 0.07, iy + size * 0.22).lineTo(ix + size * 0.25, iy + size * 0.22).stroke();
}

export function iconShield(doc: PdfDoc, x: number, y: number, size: number) {
  circle(doc, x + size / 2, y + size / 2, size / 2 - 1);
  const cx = x + size / 2;
  const top = y + size * 0.3;
  doc
    .moveTo(cx, top)
    .lineTo(cx + size * 0.16, top + size * 0.08)
    .lineTo(cx + size * 0.16, top + size * 0.24)
    .bezierCurveTo(
      cx + size * 0.16,
      top + size * 0.36,
      cx,
      top + size * 0.42,
      cx,
      top + size * 0.42
    )
    .bezierCurveTo(
      cx,
      top + size * 0.42,
      cx - size * 0.16,
      top + size * 0.36,
      cx - size * 0.16,
      top + size * 0.24
    )
    .lineTo(cx - size * 0.16, top + size * 0.08)
    .closePath()
    .stroke();
}

export function iconPhone(doc: PdfDoc, x: number, y: number) {
  doc
    .roundedRect(x, y, 6, 10, 1.2)
    .lineWidth(STROKE)
    .strokeColor(PDF_COLORS.orange)
    .stroke();
}

export function iconEmail(doc: PdfDoc, x: number, y: number) {
  doc.rect(x, y + 2, 11, 7).stroke();
  doc.moveTo(x, y + 2).lineTo(x + 5.5, y + 7).lineTo(x + 11, y + 2).stroke();
}

export function iconWeb(doc: PdfDoc, x: number, y: number) {
  doc.circle(x + 5.5, y + 5.5, 5).stroke();
  doc.moveTo(x + 1, y + 5.5).lineTo(x + 10, y + 5.5).stroke();
  doc.moveTo(x + 5.5, y + 1).lineTo(x + 5.5, y + 10).stroke();
}

export function iconTick(doc: PdfDoc, x: number, y: number) {
  circle(doc, x + 4, y + 4, 3.5);
  doc
    .moveTo(x + 2, y + 4)
    .lineTo(x + 3.5, y + 5.5)
    .lineTo(x + 6.5, y + 2.5)
    .stroke();
}
