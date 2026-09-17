"use client";

import type { RefObject } from "react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  HOME_ATTENTION_EMPTY,
  HOME_ATTENTION_TITLE,
  type HomeAttentionItem,
} from "@/lib/home/home-attention";
import {
  lockAttentionBackgroundScroll,
  readAttentionSheetViewport,
  shouldAllowAttentionTouchMove,
  unlockAttentionBackgroundScroll,
  type AttentionBackgroundScrollLock,
  type AttentionSheetViewport,
} from "@/lib/home/home-attention-sheet";

function AttentionList({
  items,
  onNavigate,
}: {
  items: HomeAttentionItem[];
  onNavigate: () => void;
}) {
  if (items.length === 0) {
    return <p className="qf-attention-empty">{HOME_ATTENTION_EMPTY}</p>;
  }

  return (
    <ul className="qf-attention-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="qf-attention-item"
            onClick={onNavigate}
          >
            <span className="qf-attention-item-copy">
              <span className="qf-attention-item-name">{item.customer}</span>
              <span className="qf-attention-item-reason">{item.reason}</span>
            </span>
            <span className="qf-attention-item-type">{item.typeLabel}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AttentionPanel({
  titleId,
  items,
  viewport,
  panelRef,
  onClose,
}: {
  titleId: string;
  items: HomeAttentionItem[];
  viewport: AttentionSheetViewport;
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  return (
    <div
      ref={panelRef}
      className="qf-attention-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-attention-mode={viewport}
    >
      <h2 id={titleId} className="qf-attention-title">
        {HOME_ATTENTION_TITLE}
      </h2>
      <div className="qf-attention-scroll" data-attention-scroll="true">
        <AttentionList items={items} onNavigate={onClose} />
      </div>
    </div>
  );
}

function subscribeAttentionViewport(onStoreChange: () => void) {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getAttentionViewportSnapshot(): AttentionSheetViewport {
  return readAttentionSheetViewport(window.innerWidth);
}

export function HomeAttentionBell({ items }: { items: HomeAttentionItem[] }) {
  const [open, setOpen] = useState(false);
  const viewport = useSyncExternalStore(
    subscribeAttentionViewport,
    getAttentionViewportSnapshot,
    () => "mobile" as const
  );
  const titleId = useId();
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef<AttentionBackgroundScrollLock | null>(null);
  const count = items.length;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || viewport !== "mobile") {
      return;
    }

    scrollLockRef.current = lockAttentionBackgroundScroll();
    const onTouchMove = (event: TouchEvent) => {
      if (!shouldAllowAttentionTouchMove(event.target)) {
        event.preventDefault();
      }
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      unlockAttentionBackgroundScroll(scrollLockRef.current);
      scrollLockRef.current = null;
    };
  }, [open, viewport]);

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.focus();
  }, [open, viewport]);

  function close() {
    setOpen(false);
    bellRef.current?.focus();
  }

  const panel = (
    <AttentionPanel
      titleId={titleId}
      items={items}
      viewport={viewport}
      panelRef={panelRef}
      onClose={close}
    />
  );

  const overlay = (
    <button
      type="button"
      className="qf-attention-overlay"
      aria-label="Close attention list"
      onClick={close}
    />
  );

  return (
    <div className="qf-attention">
      <button
        ref={bellRef}
        type="button"
        className="qf-home-notifications qf-touch-target"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          count > 0 ? `${count} items need your attention` : "Needs your attention"
        }
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 ? (
          <span className="qf-home-notifications-badge" aria-hidden="true">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open && viewport === "desktop" ? (
        <>
          {overlay}
          {panel}
        </>
      ) : null}

      {open && viewport === "mobile" && typeof document !== "undefined"
        ? createPortal(
            <div className="qf-attention-layer" data-attention-sheet="mobile">
              {overlay}
              {panel}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
