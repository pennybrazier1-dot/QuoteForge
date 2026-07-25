"use client";

import { useCallback, useEffect, useState } from "react";
import {
  completeSiteVisitAction,
  ensureSiteVisitAction,
  saveSiteVisitAction,
} from "@/lib/enquiries/server/actions";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";

type LoadState = "loading" | "ready" | "error";

type SiteVisitPatch = Partial<
  Pick<SiteVisitSession, "notes" | "measurements" | "checklist" | "voiceNotes">
>;

export function useWorkspaceSiteVisit(enquiryId: string): {
  session: (SiteVisitSession & { id: string }) | null;
  siteVisitId: string | null;
  state: LoadState;
  error: string | null;
  refresh: () => Promise<void>;
  save: (
    patch: SiteVisitPatch
  ) => Promise<
    | { ok: true; data: SiteVisitSession & { id: string } }
    | { ok: false; error: string }
  >;
  complete: () => Promise<
    | { ok: true; data: StoredEnquiry }
    | { ok: false; error: string }
  >;
} {
  const mounted = useClientMounted();
  const [session, setSession] = useState<
    (SiteVisitSession & { id: string }) | null
  >(null);
  const [siteVisitId, setSiteVisitId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!mounted || !enquiryId) {
      return;
    }

    let cancelled = false;

    void ensureSiteVisitAction(enquiryId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setSession(null);
        setSiteVisitId(null);
        setState("error");
        return;
      }

      setSession(result.data);
      setSiteVisitId(result.data.id);
      setError(null);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, enquiryId, reloadToken]);

  const save = useCallback(
    async (patch: SiteVisitPatch) => {
      const result = await saveSiteVisitAction(enquiryId, patch);
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }

      setSession(result.data);
      setSiteVisitId(result.data.id);
      return { ok: true as const, data: result.data };
    },
    [enquiryId]
  );

  const complete = useCallback(async () => {
    const result = await completeSiteVisitAction(enquiryId);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    return { ok: true as const, data: result.data };
  }, [enquiryId]);

  return { session, siteVisitId, state, error, refresh, save, complete };
}
