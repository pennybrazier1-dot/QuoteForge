import { PDF_COLORS, PDF_PAGE, PDF_RADIUS } from "@/lib/proposals/pdf/tokens";
import type { PdfDoc } from "@/lib/proposals/pdf/fonts";

export class PdfFlow {
  readonly doc: PdfDoc;
  readonly margin = PDF_PAGE.margin;
  readonly footerReserve = PDF_PAGE.footerReserve;
  private cursorY: number;

  constructor(doc: PdfDoc) {
    this.doc = doc;
    this.cursorY = this.margin;
    this.syncDocY();
  }

  get left(): number {
    return this.doc.page.margins.left;
  }

  get right(): number {
    return this.doc.page.width - this.doc.page.margins.right;
  }

  width(): number {
    return this.right - this.left;
  }

  bottom(): number {
    return this.doc.page.height - this.margin - this.footerReserve;
  }

  y(): number {
    return this.cursorY;
  }

  setY(y: number) {
    this.cursorY = y;
    this.syncDocY();
  }

  advance(amount: number) {
    this.cursorY += amount;
    this.syncDocY();
  }

  syncDocY() {
    this.doc.y = this.cursorY;
  }

  currentPageIndex(): number {
    const range = this.doc.bufferedPageRange();
    return range.start + range.count - 1;
  }

  ensureSpace(needed: number) {
    if (this.cursorY + needed > this.bottom()) {
      this.doc.addPage();
      this.cursorY = this.margin;
      this.syncDocY();
    }
  }

  /** Break to a new page only when the block cannot fit on the current page. */
  ensureSpaceAt(y: number, needed: number): number {
    if (y + needed > this.bottom()) {
      this.doc.addPage();
      return this.margin;
    }
    return y;
  }

  heightOf(
    text: string,
    width: number,
    options: { font: string; size: number; lineGap?: number }
  ): number {
    this.doc.font(options.font).fontSize(options.size);
    return this.doc.heightOfString(text, {
      width,
      lineGap: options.lineGap ?? 4,
    });
  }
}

/** Tracks vertical position within one PDF column (page + y). */
export type ColumnCursor = { page: number; y: number };

export function lastDocPageIndex(doc: PdfDoc): number {
  const range = doc.bufferedPageRange();
  return range.start + range.count - 1;
}

/** Move a column to the next page, reusing an existing page when possible. */
export function advanceColumnToNextPage(
  flow: PdfFlow,
  currentPage: number
): ColumnCursor {
  const nextPage = currentPage + 1;
  if (nextPage <= lastDocPageIndex(flow.doc)) {
    return { page: nextPage, y: flow.margin };
  }
  flow.doc.addPage();
  return { page: nextPage, y: flow.margin };
}

/** Start a new page only when the next block cannot fit at the current cursor. */
export function breakColumnIfNeeded(
  flow: PdfFlow,
  cursor: ColumnCursor,
  blockHeight: number
): ColumnCursor {
  flow.doc.switchToPage(cursor.page);
  if (cursor.y + blockHeight <= flow.bottom()) {
    return cursor;
  }
  return advanceColumnToNextPage(flow, cursor.page);
}

export function drawThinRule(
  flow: PdfFlow,
  x: number,
  y: number,
  width: number,
  color: string = PDF_COLORS.orange,
  thickness = 0.75
) {
  flow.doc
    .moveTo(x, y)
    .lineTo(x + width, y)
    .strokeColor(color)
    .lineWidth(thickness)
    .stroke();
}

export function drawDottedRule(
  flow: PdfFlow,
  x: number,
  y: number,
  width: number,
  color: string = PDF_COLORS.orange,
  thickness = 0.5
) {
  flow.doc
    .moveTo(x, y)
    .lineTo(x + width, y)
    .dash(2, { space: 2 })
    .strokeColor(color)
    .lineWidth(thickness)
    .stroke()
    .undash();
}

export function drawVerticalDottedRule(
  flow: PdfFlow,
  x: number,
  y: number,
  height: number,
  color: string = PDF_COLORS.rule,
  thickness = 0.5
) {
  flow.doc
    .moveTo(x, y)
    .lineTo(x, y + height)
    .dash(2, { space: 2 })
    .strokeColor(color)
    .lineWidth(thickness)
    .stroke()
    .undash();
}

export function fillSoftCard(
  flow: PdfFlow,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string
) {
  flow.doc.roundedRect(x, y, width, height, PDF_RADIUS).fill(fill);
  flow.doc
    .roundedRect(x, y, width, height, PDF_RADIUS)
    .lineWidth(0.5)
    .strokeColor(stroke)
    .stroke();
}

export function drawLogoPlaceholder(flow: PdfFlow, x: number, y: number, size: number) {
  fillSoftCard(flow, x, y, size, size, PDF_COLORS.card, PDF_COLORS.cardBorder);
  flow.doc
    .font("QF-Sans")
    .fontSize(5.5)
    .fillColor(PDF_COLORS.faint)
    .text("YOUR LOGO", x, y + size / 2 - 8, { width: size, align: "center" });
  flow.doc.text("HERE", x, y + size / 2 + 1, { width: size, align: "center" });
}

export function drawQrPlaceholder(flow: PdfFlow, x: number, y: number, size: number) {
  flow.doc
    .rect(x, y, size, size)
    .dash(2, { space: 2 })
    .lineWidth(0.4)
    .strokeColor(PDF_COLORS.cardBorder)
    .stroke()
    .undash();
}
