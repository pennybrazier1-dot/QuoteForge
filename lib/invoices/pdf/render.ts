/**
 * Invoice PDF presentation — same design language as the approved quote PDF
 * (QF-2026-0003 / lib/proposals/pdf/render.ts). Financial figures come from
 * InvoicePdfData unchanged; this file only controls layout and styling.
 */

import { FONT } from "@/lib/proposals/pdf/fonts";
import {
  drawDottedRule,
  drawLogoImage,
  drawQrPlaceholder,
  drawThinRule,
  fillSoftCard,
  PdfFlow,
} from "@/lib/proposals/pdf/layout";
import {
  iconClipboard,
  iconDocument,
  iconEmail,
  iconPersonFilled,
  iconPhone,
  iconPound,
  iconTick,
  iconWeb,
} from "@/lib/proposals/pdf/icons";
import {
  CARD_ICON,
  CARD_PAD,
  COL_LEFT,
  COL_RIGHT,
  LOGO_SIZE,
  PDF_COLORS,
  SP,
} from "@/lib/proposals/pdf/tokens";
import type { InvoicePdfData } from "@/lib/invoices/pdf/types";
import type { InvoiceLineItem } from "@/lib/invoices/types";
import { formatPenceAsGbp } from "@/lib/proposals/money";

/** Match quote PDF typography scale (pt). */
const TYPE = {
  business: 28,
  customer: 20,
  proposalNum: 14,
  date: 10.5,
  price: 22,
  duration: 10,
  section: 10,
  body: 9,
  bullet: 8.5,
  label: 8,
  micro: 6,
  tiny: 7,
  script: 19,
  footer: 8,
} as const;

const LINE_GAP = 4;

function fitBusinessNameSize(
  flow: PdfFlow,
  name: string,
  width: number,
  maxSize: number,
  minSize: number
): { size: number; height: number } {
  let size = maxSize;
  while (size > minSize) {
    const height = flow.heightOf(name, width, {
      font: FONT.serif,
      size,
      lineGap: 2,
    });
    if (height <= size * 2.4) {
      return { size, height };
    }
    size -= 1;
  }
  return {
    size: minSize,
    height: flow.heightOf(name, width, {
      font: FONT.serif,
      size: minSize,
      lineGap: 2,
    }),
  };
}

function microLabel(
  flow: PdfFlow,
  text: string,
  x: number,
  y: number,
  width: number,
  color: string = PDF_COLORS.faint
) {
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.micro)
    .fillColor(color)
    .text(text.toUpperCase(), x, y, { width, characterSpacing: 0.8, lineGap: 0 });
}

function labelCaps(
  flow: PdfFlow,
  text: string,
  x: number,
  y: number,
  width: number,
  color: string = PDF_COLORS.muted
) {
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.label)
    .fillColor(color)
    .text(text.toUpperCase(), x, y, { width, characterSpacing: 1, lineGap: 0 });
}

function sectionHeading(
  flow: PdfFlow,
  text: string,
  x: number,
  y: number,
  width: number,
  withUnderline = false
): number {
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.section)
    .fillColor(PDF_COLORS.orange)
    .text(text.toUpperCase(), x, y, { width, characterSpacing: 0.9, lineGap: 0 });
  const underlineY = y + 13;
  if (withUnderline) {
    drawThinRule(flow, x, underlineY, width, PDF_COLORS.orange, 0.5);
    return underlineY + SP.sm;
  }
  return y + 16;
}

function bodyText(
  flow: PdfFlow,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: { size?: number; color?: string; lineGap?: number }
): number {
  flow.doc
    .font(FONT.sans)
    .fontSize(options?.size ?? TYPE.body)
    .fillColor(options?.color ?? PDF_COLORS.text)
    .text(text, x, y, {
      width,
      lineGap: options?.lineGap ?? LINE_GAP,
    });
  return flow.doc.y;
}

function serifText(
  flow: PdfFlow,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string = PDF_COLORS.text,
  align: "left" | "right" = "left"
): number {
  flow.doc
    .font(FONT.serif)
    .fontSize(size)
    .fillColor(color)
    .text(text, x, y, { width, align, lineGap: 2 });
  return flow.doc.y;
}

function measureText(
  flow: PdfFlow,
  text: string,
  width: number,
  font: string,
  size: number,
  lineGap = LINE_GAP
): number {
  return flow.heightOf(text, width, { font, size, lineGap });
}

function columnLayout(flow: PdfFlow) {
  const width = flow.width();
  const leftWidth = width * COL_LEFT;
  const rightWidth = width * COL_RIGHT;
  const rightX = flow.left + width - rightWidth;
  return { leftWidth, rightWidth, rightX };
}

function jobSummaryText(data: InvoicePdfData): string {
  const description = data.workDescription?.trim();
  if (description) {
    return description;
  }
  const title = data.jobTitle?.trim();
  if (title) {
    return title;
  }
  return "Invoice for completed work.";
}

function lineAmountLabel(line: InvoiceLineItem): string {
  if (line.pricing_state === "included_unpriced") {
    return "Included";
  }
  return formatPenceAsGbp(line.total_amount);
}

function lineDescription(line: InvoiceLineItem): string {
  if (line.pricing_state === "included_unpriced") {
    return `${line.description} (included)`;
  }
  return line.description;
}

function drawHeader(flow: PdfFlow, data: InvoicePdfData): number {
  const { leftWidth, rightWidth, rightX } = columnLayout(flow);
  const left = flow.left;
  const top = flow.margin;
  const width = flow.width();
  const drewLogo = drawLogoImage(flow, left, top, LOGO_SIZE, data.logoBytes);
  const textX = drewLogo ? left + LOGO_SIZE + SP.md : left;
  const textWidth = drewLogo ? leftWidth - LOGO_SIZE - SP.md : leftWidth;

  if (drewLogo) {
    drawQrPlaceholder(flow, left + LOGO_SIZE - 10, top + LOGO_SIZE - 10, 10);
  }

  const businessNameFit = fitBusinessNameSize(
    flow,
    data.businessName,
    textWidth,
    TYPE.business,
    16
  );
  serifText(
    flow,
    data.businessName,
    textX,
    top,
    textWidth,
    businessNameFit.size
  );
  const nameBottom = top + businessNameFit.height;

  labelCaps(flow, "Invoice Number", rightX, top, rightWidth);
  serifText(
    flow,
    data.invoiceNumber,
    rightX,
    top + 9,
    rightWidth,
    TYPE.proposalNum,
    PDF_COLORS.orange,
    "right"
  );

  const dateLabelY = top + 9 + TYPE.proposalNum + SP.lg;
  labelCaps(flow, "Date", rightX, dateLabelY, rightWidth);
  const dateTextY = dateLabelY + 10;
  const dateHeight = flow.heightOf(data.invoiceDateLabel, rightWidth, {
    font: FONT.sans,
    size: TYPE.date,
    lineGap: 2,
  });
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.date)
    .fillColor(PDF_COLORS.text)
    .text(data.invoiceDateLabel, rightX, dateTextY, {
      width: rightWidth,
      align: "right",
      lineGap: 2,
    });

  const ruleY = Math.max(
    top + LOGO_SIZE + SP.xs,
    dateTextY + dateHeight + 3,
    nameBottom + SP.xs
  );
  drawThinRule(flow, left, ruleY, width, PDF_COLORS.orange, 0.75);
  return ruleY + SP.sm;
}

function measureAmountCard(
  flow: PdfFlow,
  label: string,
  value: string,
  width: number
): number {
  const textWidth = width - CARD_PAD * 2 - CARD_ICON - 8;
  const priceH = measureText(flow, value, textWidth, FONT.serif, TYPE.price, 2);
  const subH = TYPE.micro + 6;
  void label;
  return CARD_PAD + 14 + priceH + 8 + subH + CARD_PAD;
}

function drawAmountCard(
  flow: PdfFlow,
  title: string,
  value: string,
  subtitle: string,
  x: number,
  y: number,
  width: number,
  valueColor: string = PDF_COLORS.orange
): number {
  const height = measureAmountCard(flow, title, value, width);
  fillSoftCard(flow, x, y, width, height, PDF_COLORS.card, PDF_COLORS.cardBorder);

  const innerX = x + CARD_PAD;
  const textX = innerX + CARD_ICON + 8;
  const textWidth = width - CARD_PAD * 2 - CARD_ICON - 8;
  const innerWidth = width - CARD_PAD * 2;

  iconPound(flow.doc, innerX, y + CARD_PAD, CARD_ICON);
  microLabel(flow, title, textX, y + CARD_PAD + 2, textWidth, PDF_COLORS.muted);
  const priceBottom = serifText(
    flow,
    value,
    textX,
    y + CARD_PAD + 10,
    textWidth,
    TYPE.price,
    valueColor
  );

  const inclLineY = priceBottom + 6;
  drawThinRule(flow, innerX, inclLineY, innerWidth, PDF_COLORS.rule, 0.5);
  microLabel(flow, subtitle, textX, inclLineY + 5, textWidth);

  return y + height;
}

function measureClientCard(flow: PdfFlow, data: InvoicePdfData, width: number): number {
  const innerW = width - CARD_PAD * 2;
  const leftW = innerW * 0.52;
  const address = data.customerAddress?.trim() || "Address not specified";
  const headerH = CARD_PAD + 14 + 18 + SP.md;
  const dividerGap = SP.sm + 4;
  let detailsH = measureText(flow, address, leftW, FONT.sans, TYPE.bullet, LINE_GAP);
  if (data.customerPhone?.trim()) detailsH = Math.max(detailsH, 16);
  if (data.customerEmail?.trim()) detailsH = Math.max(detailsH, 32);
  return headerH + dividerGap + detailsH + CARD_PAD;
}

function drawClientCard(
  flow: PdfFlow,
  data: InvoicePdfData,
  x: number,
  y: number,
  width: number
): number {
  const height = measureClientCard(flow, data, width);
  fillSoftCard(
    flow,
    x,
    y,
    width,
    height,
    PDF_COLORS.cardPeach,
    PDF_COLORS.cardPeachBorder
  );

  const innerX = x + CARD_PAD;
  const innerW = width - CARD_PAD * 2;
  const leftW = innerW * 0.52;
  const rightX = innerX + innerW * 0.52;
  const rightW = innerW * 0.48;

  iconPersonFilled(flow.doc, innerX, y + CARD_PAD, 24);
  labelCaps(flow, "Client Details", innerX + 30, y + CARD_PAD + 3, innerW - 30);

  const nameY = y + CARD_PAD + 16;
  serifText(flow, data.customerName || "Customer", innerX + 30, nameY, innerW - 30, 12);

  const dividerY = nameY + 18 + SP.sm;
  drawDottedRule(flow, innerX, dividerY, innerW, PDF_COLORS.orange, 0.5);

  const detailY = dividerY + SP.md;
  const address = data.customerAddress?.trim() || "Address not specified";
  bodyText(flow, address, innerX, detailY, leftW, {
    size: TYPE.bullet,
    color: PDF_COLORS.muted,
    lineGap: LINE_GAP,
  });

  let contactY = detailY;
  if (data.customerPhone?.trim()) {
    iconPhone(flow.doc, rightX, contactY);
    bodyText(flow, data.customerPhone, rightX + 14, contactY - 1, rightW - 14, {
      size: TYPE.bullet,
    });
    contactY += 16;
  }
  if (data.customerEmail?.trim()) {
    iconEmail(flow.doc, rightX, contactY);
    bodyText(flow, data.customerEmail, rightX + 14, contactY - 1, rightW - 14, {
      size: TYPE.bullet,
    });
  }

  return y + height;
}

function drawThankYou(
  flow: PdfFlow,
  data: InvoicePdfData,
  x: number,
  y: number,
  width: number
): number {
  const scriptLine = `Thank you for choosing ${data.businessName}.`;
  flow.doc
    .font(FONT.script)
    .fontSize(TYPE.script)
    .fillColor(PDF_COLORS.orange)
    .text(scriptLine, x, y, { width, lineGap: 2 });
  return bodyText(
    flow,
    "Payment details are included below.",
    x,
    flow.doc.y + 6,
    width,
    { size: TYPE.body, color: PDF_COLORS.text }
  );
}

function drawTrustStrip(flow: PdfFlow) {
  const y = flow.y();
  const width = flow.width();
  const stripPad = SP.xs;
  const badgeRowH = 9;

  drawThinRule(flow, flow.left, y, width, PDF_COLORS.orange, 0.75);

  const badges = ["Quality workmanship", "Reliable service", "Honest pricing"];
  const badgeY = y + stripPad;

  flow.doc.font(FONT.sans).fontSize(TYPE.tiny);
  let totalW = 0;
  for (const badge of badges) {
    totalW += 10 + flow.doc.widthOfString(badge.toUpperCase()) + 16;
  }
  totalW -= 16;

  let x = flow.left + (width - totalW) / 2;
  for (let i = 0; i < badges.length; i += 1) {
    iconTick(flow.doc, x, badgeY);
    flow.doc
      .font(FONT.sans)
      .fontSize(TYPE.tiny)
      .fillColor(PDF_COLORS.muted)
      .text(badges[i].toUpperCase(), x + 10, badgeY + 1, { lineBreak: false });
    x += 10 + flow.doc.widthOfString(badges[i].toUpperCase()) + 8;
    if (i < badges.length - 1) {
      flow.doc
        .font(FONT.sans)
        .fontSize(TYPE.tiny)
        .fillColor(PDF_COLORS.orange)
        .text("•", x, badgeY + 1, { lineBreak: false });
      x += 8;
    }
  }

  const bottomRuleY = badgeY + badgeRowH + stripPad;
  drawThinRule(flow, flow.left, bottomRuleY, width, PDF_COLORS.orange, 0.75);
  flow.setY(bottomRuleY + SP.md);
}

function renderHeroColumns(flow: PdfFlow, data: InvoicePdfData) {
  const left = flow.left;
  const { leftWidth, rightWidth, rightX } = columnLayout(flow);
  const startY = flow.y();
  const summary = jobSummaryText(data);

  const customerBlockH = 12 + TYPE.customer * 0.85 + SP.lg;
  const summaryLabelH = 13 + SP.sm;
  const summaryH = measureText(flow, summary, leftWidth, FONT.sans, TYPE.body);
  const clientY = startY + customerBlockH + summaryLabelH + summaryH + SP.md;
  const clientH = measureClientCard(flow, data, leftWidth);

  const dueCardH = measureAmountCard(
    flow,
    "Amount Due",
    data.balanceDueLabel,
    rightWidth
  );
  const totalCardH = measureAmountCard(
    flow,
    "Invoice Total",
    data.totalLabel,
    rightWidth
  );
  const cardH = dueCardH + SP.sm + totalCardH;
  const thankH =
    measureText(
      flow,
      `Thank you for choosing ${data.businessName}.`,
      rightWidth,
      FONT.script,
      TYPE.script,
      2
    ) +
    6 +
    measureText(
      flow,
      "Payment details are included below.",
      rightWidth,
      FONT.sans,
      TYPE.body
    );
  const rightH = cardH + 3 + thankH;
  const leftH = clientY - startY + clientH;
  const blockH = Math.max(leftH, rightH);

  flow.ensureSpace(blockH);

  labelCaps(flow, "Invoice For", left, startY, leftWidth, PDF_COLORS.orange);
  serifText(
    flow,
    data.customerName || "Customer",
    left,
    startY + 12,
    leftWidth,
    TYPE.customer
  );

  const summaryY = startY + customerBlockH;
  const contentY = sectionHeading(flow, "Job Summary", left, summaryY, leftWidth, true);
  bodyText(flow, summary, left, contentY, leftWidth, {
    size: TYPE.body,
    lineGap: LINE_GAP,
  });

  let cardY = drawAmountCard(
    flow,
    "Amount Due",
    data.balanceDueLabel,
    "Outstanding balance",
    rightX,
    startY,
    rightWidth,
    PDF_COLORS.orange
  );
  cardY = drawAmountCard(
    flow,
    "Invoice Total",
    data.totalLabel,
    `Paid ${data.amountPaidLabel}`,
    rightX,
    cardY + SP.sm,
    rightWidth,
    PDF_COLORS.text
  );
  drawThankYou(flow, data, rightX, cardY + 3, rightWidth);

  drawClientCard(flow, data, left, clientY, leftWidth);

  flow.setY(startY + blockH + SP.sm);
}

function drawIconSectionTitle(
  flow: PdfFlow,
  title: string,
  icon: (doc: PdfFlow["doc"], x: number, y: number, size: number) => void,
  x: number,
  y: number,
  width: number
): number {
  icon(flow.doc, x, y, 14);
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.section)
    .fillColor(PDF_COLORS.orange)
    .text(title.toUpperCase(), x + 18, y + 1, {
      width: width - 18,
      characterSpacing: 0.9,
      lineGap: 0,
    });
  return y + 18;
}

function renderBodyColumns(flow: PdfFlow, data: InvoicePdfData) {
  const left = flow.left;
  const { leftWidth, rightWidth, rightX } = columnLayout(flow);
  const startY = flow.y();

  flow.ensureSpace(120);

  let leftY = drawIconSectionTitle(
    flow,
    "Line Items",
    iconClipboard,
    left,
    startY,
    leftWidth
  );
  leftY += 4;

  const descW = leftWidth * 0.62;
  const qtyW = leftWidth * 0.14;
  const amountW = leftWidth * 0.24;

  flow.doc.rect(left, leftY, leftWidth, 18).fill(PDF_COLORS.card);
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.micro)
    .fillColor(PDF_COLORS.muted)
    .text("DESCRIPTION", left + 6, leftY + 5, { width: descW - 6 })
    .text("QTY", left + descW, leftY + 5, { width: qtyW, align: "right" })
    .text("AMOUNT", left + descW + qtyW, leftY + 5, {
      width: amountW - 6,
      align: "right",
    });
  leftY += 22;

  const lines =
    data.lineItems.length > 0
      ? data.lineItems
      : ([
          {
            id: "empty",
            kind: "other",
            description: "No line items",
            quantity: 0,
            unit_amount: 0,
            total_amount: 0,
            pricing_state: "zero_confirmed",
          },
        ] as InvoiceLineItem[]);

  for (const line of lines) {
    const description = lineDescription(line);
    const amountText = lineAmountLabel(line);
    const descH = measureText(
      flow,
      description,
      descW - 6,
      FONT.sans,
      TYPE.bullet
    );
    flow.ensureSpace(descH + 12);
    if (flow.y() > leftY) {
      leftY = flow.y();
    }
    const rowY = leftY;
    flow.doc
      .font(FONT.sans)
      .fontSize(TYPE.bullet)
      .fillColor(PDF_COLORS.text)
      .text(description, left + 6, rowY, { width: descW - 6, lineGap: 2 });
    flow.doc.text(String(line.quantity), left + descW, rowY, {
      width: qtyW,
      align: "right",
    });
    flow.doc.text(amountText, left + descW + qtyW, rowY, {
      width: amountW - 6,
      align: "right",
    });
    leftY = rowY + Math.max(descH, 12) + 6;
  }

  leftY += SP.sm;
  drawThinRule(flow, left, leftY, leftWidth, PDF_COLORS.rule, 0.5);
  leftY += SP.sm;

  const totalRows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: "Subtotal", value: data.subtotalLabel },
    { label: "VAT", value: data.vatLabel },
    { label: "Total", value: data.totalLabel, strong: true },
    { label: "Payments recorded", value: data.amountPaidLabel },
    { label: "Outstanding balance", value: data.balanceDueLabel, strong: true },
  ];
  for (const row of totalRows) {
    flow.doc
      .font(FONT.sans)
      .fontSize(row.strong ? TYPE.body : TYPE.bullet)
      .fillColor(row.strong ? PDF_COLORS.text : PDF_COLORS.muted)
      .text(row.label, left, leftY, { width: leftWidth * 0.55 });
    flow.doc
      .fillColor(PDF_COLORS.text)
      .text(row.value, left + leftWidth * 0.45, leftY, {
        width: leftWidth * 0.55,
        align: "right",
      });
    leftY += row.strong ? 15 : 13;
  }

  let rightY = drawIconSectionTitle(
    flow,
    "Payment Instructions",
    iconDocument,
    rightX,
    startY,
    rightWidth
  );
  rightY += 4;

  if (data.payment) {
    const payLines = [
      data.payment.accountName
        ? `Account name: ${data.payment.accountName}`
        : null,
      data.payment.sortCode ? `Sort code: ${data.payment.sortCode}` : null,
      data.payment.accountNumber
        ? `Account number: ${data.payment.accountNumber}`
        : null,
      data.payment.reference ? `Reference: ${data.payment.reference}` : null,
      data.payment.notes,
    ].filter(Boolean) as string[];
    for (const line of payLines) {
      const h = measureText(flow, line, rightWidth, FONT.sans, TYPE.body);
      bodyText(flow, line, rightX, rightY, rightWidth, {
        size: TYPE.body,
        lineGap: 2,
      });
      rightY += h + 4;
    }
  } else {
    bodyText(
      flow,
      "No bank transfer details were issued with this invoice.",
      rightX,
      rightY,
      rightWidth,
      { size: TYPE.body, color: PDF_COLORS.muted }
    );
    rightY = flow.doc.y + SP.sm;
  }

  if (data.vatNumber?.trim()) {
    rightY += SP.sm;
    microLabel(flow, "VAT registration", rightX, rightY, rightWidth, PDF_COLORS.muted);
    rightY += 10;
    bodyText(flow, data.vatNumber.trim(), rightX, rightY, rightWidth, {
      size: TYPE.body,
    });
    rightY = flow.doc.y + SP.sm;
  }

  if (data.companyNumber?.trim()) {
    rightY += SP.sm;
    microLabel(
      flow,
      "Company registration",
      rightX,
      rightY,
      rightWidth,
      PDF_COLORS.muted
    );
    rightY += 10;
    bodyText(flow, data.companyNumber.trim(), rightX, rightY, rightWidth, {
      size: TYPE.body,
    });
    rightY = flow.doc.y + SP.sm;
  }

  if (data.businessAddressLines.length > 0) {
    rightY += SP.xs;
    microLabel(flow, "Business address", rightX, rightY, rightWidth, PDF_COLORS.muted);
    rightY += 10;
    for (const line of data.businessAddressLines) {
      bodyText(flow, line, rightX, rightY, rightWidth, {
        size: TYPE.bullet,
        color: PDF_COLORS.muted,
      });
      rightY = flow.doc.y + 2;
    }
  }

  if (data.notes?.trim()) {
    rightY += SP.md;
    rightY = drawIconSectionTitle(
      flow,
      "Notes",
      iconDocument,
      rightX,
      rightY,
      rightWidth
    );
    rightY += 4;
    bodyText(flow, data.notes.trim(), rightX, rightY, rightWidth, {
      size: TYPE.body,
    });
    rightY = flow.doc.y;
  }

  if (data.jobAddress?.trim()) {
    // Keep job site visible without inventing layout outside the quote language.
    leftY += SP.md;
    microLabel(flow, "Job address", left, leftY, leftWidth, PDF_COLORS.muted);
    leftY += 10;
    bodyText(flow, data.jobAddress.trim(), left, leftY, leftWidth, {
      size: TYPE.bullet,
      color: PDF_COLORS.muted,
    });
    leftY = flow.doc.y;
  }

  flow.setY(Math.max(leftY, rightY) + SP.lg);
}

function drawFooters(flow: PdfFlow, data: InvoicePdfData) {
  const range = flow.doc.bufferedPageRange();
  const total = range.count;

  for (let index = range.start; index < range.start + total; index += 1) {
    flow.doc.switchToPage(index);
    const pageNumber = index - range.start + 1;
    const width = flow.width();
    const footerLineY = flow.doc.page.height - flow.margin - 24;

    drawThinRule(flow, flow.left, footerLineY, width, PDF_COLORS.orange, 0.5);

    let contactX = flow.left;
    const contactY = footerLineY + SP.sm;
    if (data.businessPhone?.trim()) {
      iconPhone(flow.doc, contactX, contactY);
      flow.doc
        .font(FONT.sans)
        .fontSize(TYPE.footer)
        .fillColor(PDF_COLORS.text)
        .text(data.businessPhone, contactX + 12, contactY, { lineBreak: false });
      contactX += flow.doc.widthOfString(data.businessPhone) + 24;
    }
    if (data.businessEmail?.trim()) {
      iconEmail(flow.doc, contactX, contactY - 1);
      flow.doc
        .font(FONT.sans)
        .fontSize(TYPE.footer)
        .fillColor(PDF_COLORS.text)
        .text(data.businessEmail, contactX + 13, contactY, { lineBreak: false });
      contactX += flow.doc.widthOfString(data.businessEmail) + 24;
    }
    if (data.website?.trim()) {
      iconWeb(flow.doc, contactX, contactY - 1);
      flow.doc
        .font(FONT.sans)
        .fontSize(TYPE.footer)
        .fillColor(PDF_COLORS.text)
        .text(data.website.trim(), contactX + 13, contactY, {
          lineBreak: false,
        });
    }

    flow.doc
      .font(FONT.sans)
      .fontSize(TYPE.footer)
      .fillColor(PDF_COLORS.muted)
      .text(`Page ${pageNumber} of ${total}`, flow.left, contactY, {
        width,
        align: "right",
        lineBreak: false,
      });
  }
}

export function renderInvoicePdfDocument(
  flow: PdfFlow,
  data: InvoicePdfData
): void {
  const doc = flow.doc;
  const left = flow.left;
  const width = flow.width();

  if (data.draftWatermark) {
    doc.save();
    doc
      .font(FONT.sans)
      .fontSize(64)
      .fillColor("#F0F0F0")
      .opacity(0.45)
      .text("DRAFT", left, 360, { width, align: "center" });
    doc.restore();
  }

  flow.setY(drawHeader(flow, data));
  renderHeroColumns(flow, data);
  drawTrustStrip(flow);
  renderBodyColumns(flow, data);
  drawFooters(flow, data);
}
