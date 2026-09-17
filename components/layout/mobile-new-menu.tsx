"use client";

import { useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  MOBILE_NEW_MENU_OPTIONS,
  MOBILE_NEW_MENU_TITLE,
} from "@/lib/layout/mobile-new-menu";

export function MobileNewMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="qf-new-menu" role="dialog" aria-modal="true" aria-labelledby="qf-new-menu-title">
      <button
        type="button"
        className="qf-new-menu-overlay"
        aria-label="Close New menu"
        onClick={onClose}
      />
      <div className="qf-new-menu-sheet">
        <h2 id="qf-new-menu-title" className="qf-new-menu-title">
          {MOBILE_NEW_MENU_TITLE}
        </h2>
        <div className="qf-new-menu-options">
          {MOBILE_NEW_MENU_OPTIONS.map((option) => (
            <Link
              key={option.id}
              href={option.href}
              className="qf-new-menu-option qf-touch-target"
              onClick={onClose}
            >
              <span className="qf-new-menu-option-icon" aria-hidden="true">
                {option.id === "initial_visit" ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                )}
              </span>
              <span className="qf-new-menu-option-label">{option.label}</span>
              <span className="qf-new-menu-option-subtitle">{option.subtitle}</span>
            </Link>
          ))}
        </div>
        <button type="button" className="qf-new-menu-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
