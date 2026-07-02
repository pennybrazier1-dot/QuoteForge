"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useFormStatus } from "react-dom";
import {
  cancelProposal,
  deleteProposal,
  type ProposalManagementState,
} from "@/app/proposals/management-actions";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import { RearrangeProposalDialog } from "@/components/proposals/rearrange-proposal-dialog";
import {
  HomeCardContent,
  homeCardClassName,
} from "@/components/home/home-card-content";
import type { HomeCard, HomeSectionTone } from "@/lib/home/home-data";
import { canCancelProposal } from "@/lib/proposals/status";

const initialState: ProposalManagementState = {};
const ACTION_WIDTH = 76;
const SWIPE_OPEN_THRESHOLD = 48;

type ActiveDialog = "cancel" | "delete" | "rearrange" | null;

function useIsMobileHome(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function HomeSwipeableCard({
  card,
  sectionTone,
}: {
  card: HomeCard;
  sectionTone: HomeSectionTone;
}) {
  const isMobile = useIsMobileHome();
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);
  const showCancel = canCancelProposal(card.proposalStatus);
  const actionCount = showCancel ? 3 : 2;
  const maxOffset = ACTION_WIDTH * actionCount;

  const closeSwipe = useCallback(() => {
    setOffset(0);
  }, []);

  useEffect(() => {
    closeSwipe();
  }, [card.id, closeSwipe]);

  if (!isMobile) {
    return (
      <Link href={card.href} className={homeCardClassName(sectionTone)}>
        <HomeCardContent card={card} sectionTone={sectionTone} />
      </Link>
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    setIsDragging(true);
    dragStartX.current = event.clientX;
    dragStartOffset.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) {
      return;
    }

    const delta = event.clientX - dragStartX.current;
    const nextOffset = Math.max(
      -maxOffset,
      Math.min(0, dragStartOffset.current + delta)
    );
    setOffset(nextOffset);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setOffset((current) =>
      Math.abs(current) > SWIPE_OPEN_THRESHOLD ? -maxOffset : 0
    );
  }

  function handleRearrange() {
    closeSwipe();
    setActiveDialog("rearrange");
  }

  return (
    <>
      <div className="qf-home-swipe">
        <div
          className="qf-home-swipe-actions"
          style={{ width: `${maxOffset}px` }}
          aria-hidden={offset === 0}
        >
          <button
            type="button"
            className="qf-home-swipe-action qf-home-swipe-action-rearrange"
            style={{ width: `${ACTION_WIDTH}px` }}
            onClick={handleRearrange}
          >
            Rearrange
          </button>
          {showCancel ? (
            <button
              type="button"
              className="qf-home-swipe-action qf-home-swipe-action-cancel"
              style={{ width: `${ACTION_WIDTH}px` }}
              onClick={() => {
                closeSwipe();
                setActiveDialog("cancel");
              }}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="qf-home-swipe-action qf-home-swipe-action-delete"
            style={{ width: `${ACTION_WIDTH}px` }}
            onClick={() => {
              closeSwipe();
              setActiveDialog("delete");
            }}
          >
            Delete
          </button>
        </div>

        <div
          className={`qf-home-swipe-panel ${homeCardClassName(sectionTone)}`}
          style={{
            transform: `translateX(${offset}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <Link
            href={card.href}
            className="qf-home-swipe-link"
            onClick={(event) => {
              if (Math.abs(offset) > 8) {
                event.preventDefault();
              }
            }}
          >
            <HomeCardContent card={card} sectionTone={sectionTone} />
          </Link>
        </div>
      </div>

      {activeDialog === "cancel" ? (
        <HomeCancelDialog
          card={card}
          onClose={() => setActiveDialog(null)}
        />
      ) : null}

      {activeDialog === "delete" ? (
        <HomeDeleteDialog
          card={card}
          onClose={() => setActiveDialog(null)}
        />
      ) : null}

      <RearrangeProposalDialog
        open={activeDialog === "rearrange"}
        onClose={() => setActiveDialog(null)}
        proposalId={card.id}
        plannedStartDateText={card.plannedStartDateText}
        plannedStartDate={card.plannedStartDate}
        estimatedDuration={card.estimatedDuration}
      />
    </>
  );
}

function HomeCancelDialog({
  card,
  onClose,
}: {
  card: HomeCard;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(cancelProposal, initialState);

  return (
    <form id={`home-cancel-${card.id}`} action={formAction}>
      <input type="hidden" name="proposalId" value={card.id} />
      <input type="hidden" name="returnTo" value="dashboard" />
      <HomeCancelDialogBody
        card={card}
        error={state.error}
        onClose={onClose}
      />
    </form>
  );
}

function HomeCancelDialogBody({
  card,
  error,
  onClose,
}: {
  card: HomeCard;
  error?: string;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <ProposalConfirmDialog
      open
      title="Cancel this proposal?"
      description={
        <>
          <p>
            This will mark{" "}
            <span className="font-medium text-foreground">
              {card.proposalNumber}
            </span>{" "}
            as cancelled.
          </p>
          <p className="mt-2">
            It will be removed from your active Home lists but kept in history.
          </p>
        </>
      }
      confirmLabel="Cancel proposal"
      pendingLabel="Cancelling…"
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        (
          document.getElementById(`home-cancel-${card.id}`) as HTMLFormElement
        )?.requestSubmit();
      }}
    />
  );
}

function HomeDeleteDialog({
  card,
  onClose,
}: {
  card: HomeCard;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(deleteProposal, initialState);

  return (
    <form id={`home-delete-${card.id}`} action={formAction}>
      <input type="hidden" name="proposalId" value={card.id} />
      <HomeDeleteDialogBody card={card} error={state.error} onClose={onClose} />
    </form>
  );
}

function HomeDeleteDialogBody({
  card,
  error,
  onClose,
}: {
  card: HomeCard;
  error?: string;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <ProposalConfirmDialog
      open
      title="Delete this proposal?"
      description={
        <>
          <p>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">
              {card.proposalNumber}
            </span>
            .
          </p>
          <p className="mt-2 font-medium text-red-300">This cannot be undone.</p>
        </>
      }
      confirmLabel="Delete permanently"
      pendingLabel="Deleting…"
      pending={pending}
      destructive
      error={error}
      onClose={onClose}
      onConfirm={() => {
        (
          document.getElementById(`home-delete-${card.id}`) as HTMLFormElement
        )?.requestSubmit();
      }}
    />
  );
}
