import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOK_SITE_VISIT_DIALOG_THEME } from "@/lib/enquiries/book-site-visit-dialog-theme";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_STATUS_TONES } from "@/lib/enquiries/types";

describe("BOOK_SITE_VISIT_DIALOG_THEME", () => {
  it("uses dark-theme enquiry modal classes", () => {
    expect(BOOK_SITE_VISIT_DIALOG_THEME.panel).toBe("qf-enquiry-site-visit-panel");
    expect(BOOK_SITE_VISIT_DIALOG_THEME.message).toBe(
      "qf-enquiry-site-visit-message"
    );
    expect(BOOK_SITE_VISIT_DIALOG_THEME.slot).toBe("qf-enquiry-site-visit-slot");
    expect(BOOK_SITE_VISIT_DIALOG_THEME.preview).toBe(
      "qf-enquiry-site-visit-preview"
    );
  });

  it("has readable text rules in globals.css", () => {
    const css = readFileSync(
      resolve(process.cwd(), "app/globals.css"),
      "utf8"
    );

    expect(css).toContain(
      ".qf-enquiry-site-visit-panel .qf-enquiry-site-visit-message"
    );
    expect(css).toContain("color: var(--foreground)");
    expect(css).toContain(".qf-enquiry-site-visit-panel .qf-enquiry-detail-list dd");
  });
});

describe("enquiry status display", () => {
  it("maps declined enquiries to a distinct red badge tone", () => {
    expect(ENQUIRY_STATUS_LABELS.declined).toBe("Declined");
    expect(ENQUIRY_STATUS_TONES.declined).toBe("red");
  });
});
