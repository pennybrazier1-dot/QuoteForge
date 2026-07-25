"use client";

import { useEffect, useState } from "react";
import { JourneyProvider } from "@/lib/customer-journey/journey-provider";
import { CustomerJourneyShell } from "@/components/customer-journey/customer-journey-shell";
import { getPublicIntakeWorkspaceAction } from "@/lib/enquiries/server/public-actions";
import type { TradespersonInfo } from "@/lib/customer-journey/types";
import type { TradeType } from "@/lib/customer-journey/types";

type PublicRequestQuoteAppProps = {
  slug: string;
};

function mapTradeType(value: string | null): TradeType {
  const allowed: TradeType[] = [
    "electrical",
    "plumbing",
    "kitchen",
    "bathroom",
    "building",
    "roofing",
    "landscaping",
    "carpentry",
    "decorating",
    "heating",
    "drainage",
    "something_else",
  ];
  if (value && (allowed as string[]).includes(value)) {
    return value as TradeType;
  }
  return "something_else";
}

export function PublicRequestQuoteApp({ slug }: PublicRequestQuoteAppProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradesperson, setTradesperson] = useState<TradespersonInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await getPublicIntakeWorkspaceAction(slug);
      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const tradeType = mapTradeType(result.tradeType);
      setTradesperson({
        brandName: result.businessName.split(" ")[0] || result.businessName,
        businessName: result.businessName,
        contactName: result.businessName,
        phone: result.phone || "",
        businessType: "single-trade",
        tradeType,
        services: [],
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <p className="cj-loading">Loading quote request…</p>;
  }

  if (error || !tradesperson) {
    return (
      <div className="cj-public-invalid">
        <h1>Link not available</h1>
        <p>{error ?? "This quote request link is not valid."}</p>
      </div>
    );
  }

  return (
    <JourneyProvider
      publicSlug={slug}
      fixedTradesperson={tradesperson}
      allowPreviewSwitch={false}
    >
      <CustomerJourneyShell />
    </JourneyProvider>
  );
}
