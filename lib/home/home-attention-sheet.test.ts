import { describe, expect, it, vi } from "vitest";
import {
  ATTENTION_SHEET_SCROLL_LOCK_CLASS,
  attentionListCanReachEveryItem,
  attentionSheetLayout,
  lockAttentionBackgroundScroll,
  readAttentionSheetViewport,
  shouldAllowAttentionTouchMove,
  unlockAttentionBackgroundScroll,
  type AttentionScrollEnv,
} from "@/lib/home/home-attention-sheet";
import { HOME_ATTENTION_TITLE } from "@/lib/home/home-attention";

function createScrollEnv(scrollY = 0): AttentionScrollEnv & {
  htmlClasses: Set<string>;
  bodyClasses: Set<string>;
} {
  const htmlClasses = new Set<string>();
  const bodyClasses = new Set<string>();
  const scrollTo = vi.fn();

  return {
    htmlClasses,
    bodyClasses,
    html: {
      classList: {
        add: (value: string) => {
          htmlClasses.add(value);
        },
        remove: (value: string) => {
          htmlClasses.delete(value);
        },
      },
      style: { overflow: "" },
      scrollTop: scrollY,
    },
    body: {
      classList: {
        add: (value: string) => {
          bodyClasses.add(value);
        },
        remove: (value: string) => {
          bodyClasses.delete(value);
        },
      },
      style: { overflow: "" },
      scrollTop: 0,
    },
    scrollY,
    scrollTo,
  };
}

describe("mobile attention sheet", () => {
  it("opens as a viewport sheet, not a page section", () => {
    const layout = attentionSheetLayout("mobile");
    expect(readAttentionSheetViewport(390)).toBe("mobile");
    expect(layout.presentation).toBe("viewport_sheet");
    expect(HOME_ATTENTION_TITLE).toBe("Needs your attention");
    expect(layout.titleVisibleOnOpen).toBe(true);
    expect(layout.firstItemVisibleOnOpen).toBe(true);
  });

  it("locks background scroll while the sheet is open", () => {
    const env = createScrollEnv(180);
    const previous = lockAttentionBackgroundScroll(env);
    expect(previous?.scrollY).toBe(180);
    expect(env.htmlClasses.has(ATTENTION_SHEET_SCROLL_LOCK_CLASS)).toBe(true);
    expect(env.html.style.overflow).toBe("hidden");
    expect(env.body.style.overflow).toBe("hidden");
    expect(attentionSheetLayout("mobile").locksBackgroundScroll).toBe(true);
  });

  it("gives the attention list its own vertical scroll area", () => {
    const layout = attentionSheetLayout("mobile");
    expect(layout.listHasOwnScroll).toBe(true);
    expect(layout.listOverflowY).toBe("auto");
  });

  it("can reach more than two items by scrolling the list", () => {
    expect(attentionListCanReachEveryItem(6)).toBe(true);
    expect(attentionSheetLayout("mobile").listHasOwnScroll).toBe(true);
  });

  it("keeps the sheet above the bottom nav so the last item is not covered", () => {
    const layout = attentionSheetLayout("mobile");
    expect(layout.sitsAboveBottomNav).toBe(true);
    expect(layout.bottomOffsetToken).toBe("var(--qf-bottom-nav-measured-height)");
  });

  it("shows the title and first item in the viewport when opened", () => {
    const layout = attentionSheetLayout("mobile");
    expect(layout.titleVisibleOnOpen).toBe(true);
    expect(layout.firstItemVisibleOnOpen).toBe(true);
    expect(layout.presentation).toBe("viewport_sheet");
  });

  it("restores background scrolling and the previous Home scroll position", () => {
    const env = createScrollEnv(240);
    const previous = lockAttentionBackgroundScroll(env);
    unlockAttentionBackgroundScroll(previous, env);
    expect(env.htmlClasses.has(ATTENTION_SHEET_SCROLL_LOCK_CLASS)).toBe(false);
    expect(env.html.style.overflow).toBe("");
    expect(env.scrollTo).toHaveBeenCalledWith(0, 240);
    expect(attentionSheetLayout("mobile").restoresBackgroundScrollOnClose).toBe(
      true
    );
  });

  it("keeps the desktop bell as an anchored dropdown", () => {
    const layout = attentionSheetLayout("desktop");
    expect(readAttentionSheetViewport(1280)).toBe("desktop");
    expect(layout.presentation).toBe("anchored_dropdown");
    expect(layout.locksBackgroundScroll).toBe(false);
    expect(layout.sitsAboveBottomNav).toBe(false);
    expect(layout.desktopDropdownUnchanged).toBe(true);
    expect(layout.listHasOwnScroll).toBe(true);
  });

  it("only lets touch scrolling happen inside the attention list", () => {
    expect(
      shouldAllowAttentionTouchMove({
        closest: (selector) =>
          selector === "[data-attention-scroll='true']" ? {} : null,
      })
    ).toBe(true);
    expect(
      shouldAllowAttentionTouchMove({
        closest: () => null,
      })
    ).toBe(false);
  });
});
