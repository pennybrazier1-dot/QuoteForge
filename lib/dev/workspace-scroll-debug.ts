/**
 * Mobile scroll diagnostics — identifies the real scroll container and clearance.
 * Logs in development or when NEXT_PUBLIC_QF_SCROLL_DEBUG=1 (Vercel preview).
 */

export type WorkspaceScrollDiagnostics = {
  context: string;
  scrollContainer: string;
  documentScrollHeight: number;
  documentClientHeight: number;
  maxScrollTop: number;
  windowInnerHeight: number;
  visualViewportHeight: number | null;
  bottomNavHeight: number | null;
  scrollEndSpacerHeight: number | null;
  mainPaddingBottom: string | null;
  workspacePagePaddingBottom: string | null;
  timelineBottom: number | null;
  clearanceGap: number | null;
};

function elementLabel(element: HTMLElement): string {
  if (element === document.documentElement) {
    return "html (documentElement)";
  }

  if (element === document.body) {
    return "body";
  }

  const id = element.id ? `#${element.id}` : "";
  const classes = element.className
    ? `.${String(element.className).trim().split(/\s+/).slice(0, 3).join(".")}`
    : "";

  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function canElementScroll(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const overflowY = style.overflowY;

  return (
    element.scrollHeight > element.clientHeight + 2 &&
    (overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay" ||
      element === document.documentElement ||
      element === document.body)
  );
}

export function findWorkspaceScrollContainer(): HTMLElement | null {
  const candidates: HTMLElement[] = [
    document.documentElement,
    document.body,
    ...Array.from(
      document.querySelectorAll<HTMLElement>(
        ".qf-app-main, .qf-app-frame, .qf-app, .qf-workspace-page, .qf-proposal-page"
      )
    ),
  ];

  for (const candidate of candidates) {
    if (canElementScroll(candidate)) {
      return candidate;
    }
  }

  if (document.documentElement.scrollHeight > window.innerHeight + 1) {
    return document.documentElement;
  }

  return null;
}

export function collectWorkspaceScrollDiagnostics(
  context: string
): WorkspaceScrollDiagnostics {
  const scrollContainer = findWorkspaceScrollContainer();
  const nav = document.querySelector<HTMLElement>(".qf-bottom-nav");
  const main = document.querySelector<HTMLElement>(".qf-app-main");
  const workspacePage = document.querySelector<HTMLElement>(".qf-workspace-page");
  const scrollEnd = document.querySelector<HTMLElement>(".qf-workspace-scroll-end");
  const timeline = document.querySelector<HTMLElement>("#proposal-timeline");

  const navRect = nav?.getBoundingClientRect();
  const timelineRect = timeline?.getBoundingClientRect();

  const clearanceGap =
    navRect && timelineRect
      ? Math.round(navRect.top - timelineRect.bottom)
      : null;

  const maxScrollTop = scrollContainer
    ? scrollContainer.scrollHeight - scrollContainer.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight;

  return {
    context,
    scrollContainer: scrollContainer
      ? elementLabel(scrollContainer)
      : "unknown",
    documentScrollHeight: document.documentElement.scrollHeight,
    documentClientHeight: document.documentElement.clientHeight,
    maxScrollTop: Math.round(maxScrollTop),
    windowInnerHeight: window.innerHeight,
    visualViewportHeight: window.visualViewport?.height ?? null,
    bottomNavHeight: navRect ? Math.round(navRect.height) : null,
    scrollEndSpacerHeight: scrollEnd
      ? Math.round(scrollEnd.getBoundingClientRect().height)
      : null,
    mainPaddingBottom: main
      ? getComputedStyle(main).paddingBottom
      : null,
    workspacePagePaddingBottom: workspacePage
      ? getComputedStyle(workspacePage).paddingBottom
      : null,
    timelineBottom: timelineRect ? Math.round(timelineRect.bottom) : null,
    clearanceGap,
  };
}

export function shouldLogWorkspaceScrollDebug(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_QF_SCROLL_DEBUG === "1"
  );
}

export function logWorkspaceScrollDiagnostics(context: string): void {
  if (!shouldLogWorkspaceScrollDebug()) {
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const diagnostics = collectWorkspaceScrollDiagnostics(context);

  document.documentElement.dataset.qfScrollContainer =
    diagnostics.scrollContainer;

  console.log("[QuoteForge scroll debug]", diagnostics);
}

export function syncWorkspaceScrollEndHeight(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const nav = document.querySelector<HTMLElement>(".qf-bottom-nav");

  if (!nav) {
    return;
  }

  const navHeight = Math.ceil(nav.getBoundingClientRect().height);
  const extraGap = 24;
  const measuredEndHeight = navHeight + extraGap;

  document.documentElement.style.setProperty(
    "--qf-bottom-nav-measured-height",
    `${navHeight}px`
  );
  document.documentElement.style.setProperty(
    "--qf-workspace-scroll-end-height",
    `${measuredEndHeight}px`
  );
}
