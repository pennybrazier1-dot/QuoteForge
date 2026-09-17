"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  HOME_ATTENTION_EMPTY,
  HOME_ATTENTION_TITLE,
  type HomeAttentionItem,
} from "@/lib/home/home-attention";

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

export function HomeAttentionBell({ items }: { items: HomeAttentionItem[] }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const count = items.length;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="qf-attention">
      <button
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

      {open ? (
        <>
          <button
            type="button"
            className="qf-attention-overlay"
            aria-label="Close attention list"
            onClick={() => setOpen(false)}
          />
          <div
            className="qf-attention-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId} className="qf-attention-title">
              {HOME_ATTENTION_TITLE}
            </h2>
            <AttentionList items={items} onNavigate={() => setOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}
