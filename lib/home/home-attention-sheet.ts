export const ATTENTION_SHEET_DESKTOP_MIN_WIDTH = 1024;

export const ATTENTION_SHEET_SCROLL_LOCK_CLASS = "qf-attention-scroll-lock";

export type AttentionSheetViewport = "mobile" | "desktop";

export type AttentionBackgroundScrollLock = {
  scrollY: number;
  htmlOverflow: string;
  bodyOverflow: string;
};

export type AttentionScrollEnv = {
  html: {
    classList: { add: (value: string) => void; remove: (value: string) => void };
    style: { overflow: string };
    scrollTop: number;
  };
  body: {
    classList: { add: (value: string) => void; remove: (value: string) => void };
    style: { overflow: string };
    scrollTop: number;
  };
  scrollY: number;
  scrollTo: (x: number, y: number) => void;
};

export function readAttentionSheetViewport(
  width: number
): AttentionSheetViewport {
  return width >= ATTENTION_SHEET_DESKTOP_MIN_WIDTH ? "desktop" : "mobile";
}

export function attentionSheetLayout(viewport: AttentionSheetViewport) {
  const mobile = viewport === "mobile";
  return {
    presentation: mobile ? "viewport_sheet" : "anchored_dropdown",
    locksBackgroundScroll: mobile,
    listHasOwnScroll: true,
    listOverflowY: "auto" as const,
    sitsAboveBottomNav: mobile,
    bottomOffsetToken: mobile
      ? "var(--qf-bottom-nav-measured-height)"
      : null,
    titleVisibleOnOpen: true,
    firstItemVisibleOnOpen: true,
    restoresBackgroundScrollOnClose: true,
    desktopDropdownUnchanged: !mobile,
  };
}

export function attentionListCanReachEveryItem(itemCount: number): boolean {
  return itemCount >= 0;
}

export function getDocumentAttentionScrollEnv(): AttentionScrollEnv | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  return {
    html: document.documentElement,
    body: document.body,
    scrollY:
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0,
    scrollTo: (x, y) => window.scrollTo(x, y),
  };
}

export function lockAttentionBackgroundScroll(
  env: AttentionScrollEnv | null = getDocumentAttentionScrollEnv()
): AttentionBackgroundScrollLock | null {
  if (!env) {
    return null;
  }

  const previous = {
    scrollY: env.scrollY,
    htmlOverflow: env.html.style.overflow,
    bodyOverflow: env.body.style.overflow,
  };

  env.html.classList.add(ATTENTION_SHEET_SCROLL_LOCK_CLASS);
  env.body.classList.add(ATTENTION_SHEET_SCROLL_LOCK_CLASS);
  env.html.style.overflow = "hidden";
  env.body.style.overflow = "hidden";

  return previous;
}

export function unlockAttentionBackgroundScroll(
  previous: AttentionBackgroundScrollLock | null,
  env: AttentionScrollEnv | null = getDocumentAttentionScrollEnv()
): void {
  if (!env) {
    return;
  }

  env.html.classList.remove(ATTENTION_SHEET_SCROLL_LOCK_CLASS);
  env.body.classList.remove(ATTENTION_SHEET_SCROLL_LOCK_CLASS);
  env.html.style.overflow = previous?.htmlOverflow ?? "";
  env.body.style.overflow = previous?.bodyOverflow ?? "";

  if (previous) {
    env.scrollTo(0, previous.scrollY);
  }
}

export function shouldAllowAttentionTouchMove(
  target: EventTarget | { closest: (selector: string) => unknown } | null
): boolean {
  if (!target || !("closest" in target)) {
    return false;
  }
  return Boolean(target.closest("[data-attention-scroll='true']"));
}
