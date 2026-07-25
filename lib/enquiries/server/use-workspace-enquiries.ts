"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listWorkspaceEnquiries,
  getWorkspaceEnquiry,
} from "@/lib/enquiries/server/actions";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

type LoadState = "loading" | "ready" | "error";

export function useWorkspaceEnquiries(): {
  enquiries: StoredEnquiry[];
  state: LoadState;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const mounted = useClientMounted();
  const [enquiries, setEnquiries] = useState<StoredEnquiry[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;

    void listWorkspaceEnquiries().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setEnquiries([]);
        setState("error");
        return;
      }

      setEnquiries(result.data);
      setError(null);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, reloadToken]);

  return { enquiries, state, error, refresh };
}

export function useWorkspaceEnquiry(enquiryId: string): {
  enquiry: StoredEnquiry | null;
  state: LoadState;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const mounted = useClientMounted();
  const [enquiry, setEnquiry] = useState<StoredEnquiry | null>(null);
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

    void getWorkspaceEnquiry(enquiryId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setEnquiry(null);
        setState("error");
        return;
      }

      setEnquiry(result.data);
      setError(null);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, enquiryId, reloadToken]);

  return { enquiry, state, error, refresh };
}
