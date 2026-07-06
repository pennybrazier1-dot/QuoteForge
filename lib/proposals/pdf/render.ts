import { formatPenceAsGbp } from "@/lib/proposals/money";
import { FONT } from "@/lib/proposals/pdf/fonts";
import {
  breakColumnIfNeeded,
  ColumnCursor,
  drawDottedRule,
  drawLogoPlaceholder,
  drawQrPlaceholder,
  drawThinRule,
  drawVerticalDottedRule,
  fillSoftCard,
  PdfFlow,
} from "@/lib/proposals/pdf/layout";
import {
  iconBricks,
  iconCalendar,
  iconClipboard,
  iconDocument,
  iconEmail,
  iconInfo,
  iconPersonFilled,
  iconPhone,
  iconPound,
  iconShield,
  iconStar,
  iconTick,
  iconWeb,
} from "@/lib/proposals/pdf/icons";
import {
  CARD_ICON,
  CARD_PAD,
  COL_LEFT,
  COL_RIGHT,
  ICON_SIZE,
  LOGO_SIZE,
  PDF_COLORS,
  SP,
} from "@/lib/proposals/pdf/tokens";
import type { ProposalPdfData } from "@/lib/proposals/pdf/types";

/** Mock-up typography scale (pt) */
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
const BULLET_GAP = 2;

type IconFn = (doc: PdfFlow["doc"], x: number, y: number, size: number) => void;

function formatPdfDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
    new Date(value)
  );
}

function formatTradeTagline(tradeType: string | null): string {
  if (!tradeType || tradeType === "Other") {
    return "PROFESSIONAL TRADE SPECIALISTS";
  }
  return `PROFESSIONAL ${tradeType.toUpperCase()}`;
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
  options?: { size?: number; color?: string; lineGap?: number; maxHeight?: number }
): number {
  const textOptions: {
    width: number;
    lineGap: number;
    height?: number;
  } = {
    width,
    lineGap: options?.lineGap ?? LINE_GAP,
  };
  if (options?.maxHeight !== undefined) {
    textOptions.height = options.maxHeight;
  }
  flow.doc
    .font(FONT.sans)
    .fontSize(options?.size ?? TYPE.body)
    .fillColor(options?.color ?? PDF_COLORS.text)
    .text(text, x, y, textOptions);
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

function bodyTextFitted(
  flow: PdfFlow,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: { size?: number; color?: string; lineGap?: number }
): number {
  const size = options?.size ?? TYPE.body;
  const lineGap = options?.lineGap ?? LINE_GAP;
  const h = measureText(flow, text, width, FONT.sans, size, lineGap);
  flow.doc
    .font(FONT.sans)
    .fontSize(size)
    .fillColor(options?.color ?? PDF_COLORS.text)
    .text(text, x, y, { width, lineGap, height: h });
  return y + h;
}

function drawBulletsFlowing(
  flow: PdfFlow,
  items: string[],
  x: number,
  cursor: ColumnCursor,
  width: number,
  fallback: string
): ColumnCursor {
  if (items.length === 0) {
    const blockH = measureText(flow, fallback, width, FONT.sans, TYPE.bullet);
    const next = breakColumnIfNeeded(flow, cursor, blockH);
    flow.doc.switchToPage(next.page);
    const endY = bodyTextFitted(flow, fallback, x, next.y, width, {
      size: TYPE.bullet,
      color: PDF_COLORS.muted,
    });
    return { page: next.page, y: endY };
  }

  let current = cursor;
  const indent = 10;

  for (const item of items) {
    const itemH = measureText(flow, item, width - indent, FONT.sans, TYPE.bullet);
    current = breakColumnIfNeeded(flow, current, itemH + BULLET_GAP);
    flow.doc.switchToPage(current.page);
    flow.doc
      .font(FONT.sans)
      .fontSize(TYPE.bullet)
      .fillColor(PDF_COLORS.text)
      .text("•", x, current.y, { width: indent, lineBreak: false });
    flow.doc.text(item, x + indent, current.y, {
      width: width - indent,
      lineGap: LINE_GAP,
      height: itemH,
    });
    current = { page: current.page, y: current.y + itemH + BULLET_GAP };
  }

  return current;
}

function drawBodyFlowing(
  flow: PdfFlow,
  text: string,
  x: number,
  cursor: ColumnCursor,
  width: number,
  options?: { size?: number; color?: string; lineGap?: number }
): ColumnCursor {
  const size = options?.size ?? TYPE.body;
  const lineGap = options?.lineGap ?? LINE_GAP;
  const blockH = measureText(flow, text, width, FONT.sans, size, lineGap);
  const next = breakColumnIfNeeded(flow, cursor, blockH);
  flow.doc.switchToPage(next.page);
  const endY = bodyTextFitted(flow, text, x, next.y, width, {
    size,
    color: options?.color,
    lineGap,
  });
  return { page: next.page, y: endY };
}

function columnLayout(flow: PdfFlow) {
  const width = flow.width();
  const gutter = width * (1 - COL_LEFT - COL_RIGHT);
  const leftWidth = width * COL_LEFT;
  const rightWidth = width * COL_RIGHT;
  const rightX = flow.left + width - rightWidth;
  return { leftWidth, rightWidth, rightX, gutter };
}

function drawHeader(flow: PdfFlow, data: ProposalPdfData): number {
  const { leftWidth, rightWidth, rightX } = columnLayout(flow);
  const left = flow.left;
  const top = flow.margin;
  const width = flow.width();
  const textX = left + LOGO_SIZE + SP.md;
  const textWidth = leftWidth - LOGO_SIZE - SP.md;

  drawLogoPlaceholder(flow, left, top, LOGO_SIZE);
  drawQrPlaceholder(flow, left + LOGO_SIZE - 10, top + LOGO_SIZE - 10, 10);

  serifText(flow, data.businessName, textX, top, textWidth, TYPE.business);
  labelCaps(
    flow,
    formatTradeTagline(data.tradeType),
    textX,
    flow.doc.y + 4,
    textWidth,
    PDF_COLORS.orange
  );

  labelCaps(flow, "Proposal Number", rightX, top, rightWidth);
  serifText(
    flow,
    data.proposalNumber,
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
  const dateStr = formatPdfDate(data.createdAt);
  const dateHeight = flow.heightOf(dateStr, rightWidth, {
    font: FONT.sans,
    size: TYPE.date,
    lineGap: 2,
  });
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.date)
    .fillColor(PDF_COLORS.text)
    .text(dateStr, rightX, dateTextY, {
      width: rightWidth,
      align: "right",
      lineGap: 2,
    });

  const ruleY = Math.max(top + LOGO_SIZE + SP.xs, dateTextY + dateHeight + 3);
  drawThinRule(flow, left, ruleY, width, PDF_COLORS.orange, 0.75);
  return ruleY + SP.sm;
}

function formatDurationForCard(duration: string): string {
  if (!duration || duration === "Not specified") {
    return duration;
  }

  let core = duration.trim().replace(/^approximately\s+/i, "");
  core = core.replace(/\s*,?\s*depending on.*$/i, "").trim();
  if (!core) {
    core = duration.trim();
  }

  return `Approximately ${core}`;
}

const DURATION_NOTE = "Depending on ground conditions";

function measureDurationCard(flow: PdfFlow, data: ProposalPdfData, width: number): number {
  const textWidth = width - CARD_PAD * 2 - CARD_ICON - 8;
  const durationH = measureText(
    flow,
    formatDurationForCard(data.estimatedDuration),
    textWidth,
    FONT.serif,
    TYPE.duration,
    3
  );
  const noteH =
    data.estimatedDuration !== "Not specified" ? TYPE.micro + 6 : 0;
  return CARD_PAD + 18 + durationH + noteH + CARD_PAD;
}

function drawDurationCard(
  flow: PdfFlow,
  data: ProposalPdfData,
  x: number,
  y: number,
  width: number
): number {
  const height = measureDurationCard(flow, data, width);
  fillSoftCard(flow, x, y, width, height, PDF_COLORS.card, PDF_COLORS.cardBorder);

  const innerX = x + CARD_PAD;
  const textX = innerX + CARD_ICON + 8;
  const textWidth = width - CARD_PAD * 2 - CARD_ICON - 8;

  iconCalendar(flow.doc, innerX, y + CARD_PAD, CARD_ICON);
  microLabel(flow, "Estimated Duration", textX, y + CARD_PAD + 2, textWidth, PDF_COLORS.muted);
  const durationBottom = serifText(
    flow,
    formatDurationForCard(data.estimatedDuration),
    textX,
    y + CARD_PAD + 18,
    textWidth,
    TYPE.duration
  );

  if (data.estimatedDuration !== "Not specified") {
    microLabel(flow, DURATION_NOTE, textX, durationBottom + 4, textWidth);
  }

  return y + height;
}

function measureInvestmentCard(flow: PdfFlow, data: ProposalPdfData, width: number): number {
  const textWidth = width - CARD_PAD * 2 - CARD_ICON - 8;
  const priceH = measureText(
    flow,
    formatPenceAsGbp(data.estimatedPrice),
    textWidth,
    FONT.serif,
    TYPE.price,
    2
  );
  const inclH = TYPE.micro + 6;
  return CARD_PAD + 14 + priceH + 8 + inclH + CARD_PAD;
}

function drawInvestmentCard(
  flow: PdfFlow,
  data: ProposalPdfData,
  x: number,
  y: number,
  width: number
): number {
  const height = measureInvestmentCard(flow, data, width);
  fillSoftCard(flow, x, y, width, height, PDF_COLORS.card, PDF_COLORS.cardBorder);

  const innerX = x + CARD_PAD;
  const textX = innerX + CARD_ICON + 8;
  const textWidth = width - CARD_PAD * 2 - CARD_ICON - 8;
  const innerWidth = width - CARD_PAD * 2;

  iconPound(flow.doc, innerX, y + CARD_PAD, CARD_ICON);
  microLabel(flow, "Total Investment", textX, y + CARD_PAD + 2, textWidth, PDF_COLORS.muted);
  const priceBottom = serifText(
    flow,
    formatPenceAsGbp(data.estimatedPrice),
    textX,
    y + CARD_PAD + 10,
    textWidth,
    TYPE.price,
    PDF_COLORS.orange
  );

  const inclLineY = priceBottom + 6;
  drawThinRule(flow, innerX, inclLineY, innerWidth, PDF_COLORS.rule, 0.5);
  microLabel(
    flow,
    "Including materials",
    textX,
    inclLineY + 5,
    textWidth
  );

  return y + height;
}

function measureRightColumnCards(
  flow: PdfFlow,
  data: ProposalPdfData,
  width: number
): number {
  return (
    measureInvestmentCard(flow, data, width) +
    SP.sm +
    measureDurationCard(flow, data, width)
  );
}

function drawRightColumnCards(
  flow: PdfFlow,
  data: ProposalPdfData,
  x: number,
  y: number,
  width: number
): number {
  let cursor = drawInvestmentCard(flow, data, x, y, width);
  cursor += SP.sm;
  return drawDurationCard(flow, data, x, cursor, width);
}

function measureClientCard(flow: PdfFlow, data: ProposalPdfData, width: number): number {
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
  data: ProposalPdfData,
  x: number,
  y: number,
  width: number
): number {
  const height = measureClientCard(flow, data, width);
  fillSoftCard(flow, x, y, width, height, PDF_COLORS.cardPeach, PDF_COLORS.cardPeachBorder);

  const innerX = x + CARD_PAD;
  const innerW = width - CARD_PAD * 2;
  const leftW = innerW * 0.52;
  const rightX = innerX + innerW * 0.52;
  const rightW = innerW * 0.48;

  iconPersonFilled(flow.doc, innerX, y + CARD_PAD, 24);
  labelCaps(flow, "Client Details", innerX + 30, y + CARD_PAD + 3, innerW - 30);

  const nameY = y + CARD_PAD + 16;
  serifText(flow, data.customerName ?? "Customer", innerX + 30, nameY, innerW - 30, 12);

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

function measureThankYou(flow: PdfFlow, data: ProposalPdfData, width: number): number {
  const scriptLine = `Thank you for considering ${data.businessName}.`;
  const scriptH = measureText(flow, scriptLine, width, FONT.script, TYPE.script, 2);
  const bodyH = measureText(
    flow,
    "We look forward to working with you.",
    width,
    FONT.sans,
    TYPE.body
  );
  return scriptH + 6 + bodyH;
}

function drawThankYou(
  flow: PdfFlow,
  data: ProposalPdfData,
  x: number,
  y: number,
  width: number
): number {
  const scriptLine = `Thank you for considering ${data.businessName}.`;
  flow.doc
    .font(FONT.script)
    .fontSize(TYPE.script)
    .fillColor(PDF_COLORS.orange)
    .text(scriptLine, x, y, { width, lineGap: 2 });
  return bodyText(
    flow,
    "We look forward to working with you.",
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

function renderHeroColumns(flow: PdfFlow, data: ProposalPdfData) {
  const left = flow.left;
  const { leftWidth, rightWidth, rightX } = columnLayout(flow);
  const startY = flow.y();

  const customerBlockH = 12 + TYPE.customer * 0.85 + SP.lg;
  const summaryLabelH = 13 + SP.sm;
  const summaryH = measureText(flow, data.projectSummary, leftWidth, FONT.sans, TYPE.body);
  const clientY = startY + customerBlockH + summaryLabelH + summaryH + SP.md;
  const clientH = measureClientCard(flow, data, leftWidth);

  const cardH = measureRightColumnCards(flow, data, rightWidth);
  const thankH = measureThankYou(flow, data, rightWidth);
  const rightH = cardH + 3 + thankH;
  const leftH = clientY - startY + clientH;
  const blockH = Math.max(leftH, rightH);

  flow.ensureSpace(blockH);

  labelCaps(flow, "Proposal For", left, startY, leftWidth, PDF_COLORS.orange);
  serifText(
    flow,
    data.customerName ?? "Customer",
    left,
    startY + 12,
    leftWidth,
    TYPE.customer
  );

  const summaryY = startY + customerBlockH;
  const contentY = sectionHeading(flow, "Project Summary", left, summaryY, leftWidth, true);
  bodyText(flow, data.projectSummary, left, contentY, leftWidth, {
    size: TYPE.body,
    lineGap: LINE_GAP,
  });

  const cardBottom = drawRightColumnCards(flow, data, rightX, startY, rightWidth);
  drawThankYou(flow, data, rightX, cardBottom + 3, rightWidth);

  drawClientCard(flow, data, left, clientY, leftWidth);

  flow.setY(startY + blockH + SP.sm);
}

type TechSection = {
  title: string;
  drawIcon: IconFn;
  renderContent: (
    flow: PdfFlow,
    x: number,
    cursor: ColumnCursor,
    width: number
  ) => ColumnCursor;
};

const TECH_TITLE_HEIGHT = 13;
const TECH_HEADER_HEIGHT = TECH_TITLE_HEIGHT + 3;
const TECH_SECTION_GAP = 3;
const TECH_SEPARATOR_HEIGHT = 3;

function acceptanceSection(): TechSection {
  return {
    title: "Acceptance",
    drawIcon: iconShield,
    renderContent: (pdfFlow, x, cursor, w) => {
      const intro =
        "By signing below, the customer confirms acceptance of this proposal, including the scope of work, materials, price, and payment terms set out above. Acceptance may also be recorded through QuoteForge or by another method agreed in writing with the tradesperson.";
      let current = drawBodyFlowing(pdfFlow, intro, x, cursor, w, {
        size: TYPE.bullet,
        lineGap: LINE_GAP,
      });
      current = { page: current.page, y: current.y + SP.xs };

      for (const label of ["Signature", "Printed Name", "Date"]) {
        current = breakColumnIfNeeded(pdfFlow, current, 24);
        pdfFlow.doc.switchToPage(current.page);
        labelCaps(pdfFlow, label, x, current.y, w);
        drawThinRule(
          pdfFlow,
          x,
          current.y + 12,
          label === "Date" ? w * 0.55 : w,
          PDF_COLORS.rule,
          0.5
        );
        current = { page: current.page, y: current.y + 24 };
      }

      return current;
    },
  };
}

function thingsToConfirmSection(flow: PdfFlow, data: ProposalPdfData): TechSection {
  return {
    title: "Things to Confirm",
    drawIcon: iconInfo,
    renderContent: (pdfFlow, x, cursor, w) => {
      if (data.thingsToConfirm.length > 0) {
        return drawBulletsFlowing(
          pdfFlow,
          data.thingsToConfirm,
          x,
          cursor,
          w,
          "None listed."
        );
      }

      return drawBodyFlowing(
        pdfFlow,
        data.thingsToConfirmText?.trim() || "None listed.",
        x,
        cursor,
        w,
        { size: TYPE.bullet, color: PDF_COLORS.muted }
      );
    },
  };
}

function technicalColumnLayout(flow: PdfFlow) {
  const gutter = SP.md;
  const width = flow.width();
  const colWidth = (width - gutter) / 2;
  const leftX = flow.left;
  const rightX = flow.left + colWidth + gutter;
  const dividerX = flow.left + colWidth + gutter / 2;
  return { leftX, rightX, colWidth, dividerX };
}

function drawSectionHeader(
  flow: PdfFlow,
  section: TechSection,
  x: number,
  y: number,
  width: number
): number {
  section.drawIcon(flow.doc, x, y, ICON_SIZE);
  flow.doc
    .font(FONT.sans)
    .fontSize(TYPE.section)
    .fillColor(PDF_COLORS.orange)
    .text(section.title.toUpperCase(), x + 20, y + 1, {
      width: width - 20,
      characterSpacing: 0.9,
      lineGap: 0,
    });

  return y + TECH_HEADER_HEIGHT;
}

function renderFlowingColumn(
  flow: PdfFlow,
  sections: TechSection[],
  colX: number,
  colWidth: number,
  start: ColumnCursor
): ColumnCursor {
  let cursor = start;

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const isLast = i === sections.length - 1;

    cursor = breakColumnIfNeeded(flow, cursor, TECH_HEADER_HEIGHT);
    flow.doc.switchToPage(cursor.page);

    const contentStartY = drawSectionHeader(flow, section, colX, cursor.y, colWidth);
    cursor = section.renderContent(flow, colX, {
      page: cursor.page,
      y: contentStartY,
    }, colWidth);

    if (!isLast) {
      cursor = {
        page: cursor.page,
        y: cursor.y + TECH_SEPARATOR_HEIGHT,
      };
      flow.doc.switchToPage(cursor.page);
      drawThinRule(flow, colX, cursor.y, colWidth, PDF_COLORS.orange, 0.5);
      cursor = {
        page: cursor.page,
        y: cursor.y + TECH_SECTION_GAP,
      };
    }
  }

  return cursor;
}

function drawTechnicalDivider(
  flow: PdfFlow,
  dividerX: number,
  startY: number,
  startPage: number,
  left: ColumnCursor,
  right: ColumnCursor
) {
  const lastPage = Math.max(left.page, right.page, startPage);

  for (let page = startPage; page <= lastPage; page += 1) {
    flow.doc.switchToPage(page);
    const top = page === startPage ? startY : flow.margin;
    let bottom = flow.bottom();

    if (page === lastPage) {
      bottom = flow.margin;
      if (left.page === page) {
        bottom = Math.max(bottom, left.y);
      }
      if (right.page === page) {
        bottom = Math.max(bottom, right.y);
      }
    }

    if (bottom > top + 4) {
      drawVerticalDottedRule(flow, dividerX, top, bottom - top, PDF_COLORS.rule);
    }
  }
}

function renderFlowingTechnicalColumns(flow: PdfFlow, data: ProposalPdfData) {
  const { leftX, rightX, colWidth, dividerX } = technicalColumnLayout(flow);
  const startY = flow.y();
  const startPage = flow.currentPageIndex();

  const leftSections: TechSection[] = [
    {
      title: "Scope of Work",
      drawIcon: iconClipboard,
      renderContent: (pdfFlow, x, cursor, w) =>
        drawBulletsFlowing(
          pdfFlow,
          data.scopeOfWork,
          x,
          cursor,
          w,
          "None listed."
        ),
    },
    {
      title: "Materials",
      drawIcon: iconBricks,
      renderContent: (pdfFlow, x, cursor, w) =>
        drawBulletsFlowing(
          pdfFlow,
          data.materials,
          x,
          cursor,
          w,
          "None listed."
        ),
    },
    thingsToConfirmSection(flow, data),
  ];

  const rightSections: TechSection[] = [
    {
      title: "Optional Extras",
      drawIcon: iconStar,
      renderContent: (pdfFlow, x, cursor, w) =>
        drawBodyFlowing(pdfFlow, data.optionalExtras, x, cursor, w, {
          size: TYPE.bullet,
          lineGap: LINE_GAP,
        }),
    },
    {
      title: "Payment Terms",
      drawIcon: iconDocument,
      renderContent: (pdfFlow, x, cursor, w) =>
        drawBodyFlowing(pdfFlow, data.paymentTerms, x, cursor, w, {
          size: TYPE.body,
          lineGap: LINE_GAP,
        }),
    },
    acceptanceSection(),
  ];

  const columnStart: ColumnCursor = { page: startPage, y: startY };

  const leftEnd = renderFlowingColumn(
    flow,
    leftSections,
    leftX,
    colWidth,
    columnStart
  );
  const rightEnd = renderFlowingColumn(
    flow,
    rightSections,
    rightX,
    colWidth,
    columnStart
  );

  drawTechnicalDivider(flow, dividerX, startY, startPage, leftEnd, rightEnd);

  flow.setY(Math.max(leftEnd.y, rightEnd.y));
}

function drawFooters(flow: PdfFlow, data: ProposalPdfData) {
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
    if (data.phone?.trim()) {
      iconPhone(flow.doc, contactX, contactY);
      flow.doc
        .font(FONT.sans)
        .fontSize(TYPE.footer)
        .fillColor(PDF_COLORS.text)
        .text(data.phone, contactX + 12, contactY, { lineBreak: false });
      contactX += flow.doc.widthOfString(data.phone) + 24;
    }
    if (data.contactEmail?.trim()) {
      iconEmail(flow.doc, contactX, contactY - 1);
      flow.doc
        .font(FONT.sans)
        .fontSize(TYPE.footer)
        .fillColor(PDF_COLORS.text)
        .text(data.contactEmail, contactX + 13, contactY, { lineBreak: false });
      contactX += flow.doc.widthOfString(data.contactEmail) + 24;
    }
    iconWeb(flow.doc, contactX, contactY - 1);
    flow.doc
      .font(FONT.sans)
      .fontSize(TYPE.footer)
      .fillColor(data.website?.trim() ? PDF_COLORS.text : PDF_COLORS.muted)
      .text(data.website?.trim() || "Website coming soon", contactX + 13, contactY, {
        lineBreak: false,
      });

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

export function renderProposalPdfDocument(flow: PdfFlow, data: ProposalPdfData) {
  flow.setY(drawHeader(flow, data));
  renderHeroColumns(flow, data);
  drawTrustStrip(flow);
  renderFlowingTechnicalColumns(flow, data);
  drawFooters(flow, data);
}
