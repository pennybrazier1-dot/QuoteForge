import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Help for using Reanvil.",
};

export default function HelpPage() {
  return (
    <div className="qf-trader-page qf-page-simple">
      <header className="qf-page-simple-header">
        <h1 className="qf-page-simple-title">Help & Support</h1>
        <p className="qf-page-simple-subtitle">
          Need a hand with Reanvil?
        </p>
      </header>
      <div className="qf-visit-empty">
        <h2 className="qf-visit-empty-title">Support is coming here</h2>
        <p className="qf-visit-empty-copy">
          Help articles and support details will appear on this page when they
          are available.
        </p>
      </div>
    </div>
  );
}
