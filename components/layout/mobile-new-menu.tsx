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
