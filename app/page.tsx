import type { ReactNode } from "react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Features />
        <Mission />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Navigation                                                              */
/* ----------------------------------------------------------------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#mission" className="transition-colors hover:text-foreground">
            Mission
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden text-sm font-medium text-muted transition-colors hover:text-foreground sm:block"
          >
            Sign in
          </a>
          <a
            href="/signup"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <a href="#" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-black">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight">QuoteForge</span>
    </a>
  );
}

/* ----------------------------------------------------------------------- */
/* Hero                                                                    */
/* ----------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="bg-hero-glow relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-28">
        {/* Left: copy */}
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            AI sales assistant for tradespeople
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Spend less time quoting.
            <br />
            <span className="text-accent">Win more work.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            QuoteForge turns a few quick details about the job into a polished,
            professional quote your customer can read in minutes. Built for
            self-employed tradespeople and small trade businesses who&apos;d
            rather be on the tools than stuck behind a laptop.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#pricing"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-black transition-colors hover:bg-accent-hover"
            >
              Start quoting for free
            </a>
            <a
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border-subtle px-7 text-base font-medium text-foreground transition-colors hover:bg-background-elevated"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-sm text-muted">
            No card required · Set up in under 5 minutes
          </p>
        </div>

        {/* Right: mock proposal preview card */}
        <ProposalPreview />
      </div>
    </section>
  );
}

function ProposalPreview() {
  return (
    <div className="relative">
      {/* Glow halo behind the card */}
      <div className="absolute -inset-4 rounded-[2rem] bg-accent/10 blur-2xl" />

      <div className="relative rounded-2xl border border-border-subtle bg-background-elevated shadow-2xl shadow-black/40">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3.5">
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="ml-3 text-xs text-muted">Quote #1042 — Draft</span>
        </div>

        {/* Card body */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-black">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold">Riverside Plumbing</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-wider text-muted">
                Prepared for
              </p>
              <p className="text-sm font-medium">Mrs. Sarah Whitfield</p>
            </div>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              Ready to send
            </span>
          </div>

          {/* Line items */}
          <div className="mt-6 space-y-3">
            <LineItem label="Replace bathroom mixer tap" price="£140.00" />
            <LineItem label="Supply &amp; fit thermostatic valve" price="£210.00" />
            <LineItem label="Labour — 3 hrs" price="£135.00" />
          </div>

          <div className="mt-5 border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span>£485.00</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-muted">
              <span>VAT (20%)</span>
              <span>£97.00</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-base font-semibold">Total</span>
              <span className="text-base font-semibold text-accent">£582.00</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-xs text-accent">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Drafted by QuoteForge AI in 38 seconds
          </div>
        </div>
      </div>
    </div>
  );
}

function LineItem({ label, price }: { label: string; price: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground/90">{label}</span>
      <span className="text-sm font-medium text-muted">{price}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Features                                                                */
/* ----------------------------------------------------------------------- */

function Features() {
  return (
    <section id="features" className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to quote like a bigger business
          </h2>
          <p className="mt-4 text-lg text-muted">
            QuoteForge does the admin so you can focus on the work. Describe the
            job, and let the assistant handle the rest.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Quotes in minutes"
            description="Type a few details about the job and QuoteForge writes a clear, itemised quote — wording, pricing and all — ready to send."
            icon={
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            }
          />
          <FeatureCard
            title="Sounds like a pro"
            description="Every quote reads professionally and consistently, so small one-person businesses can look as polished as the big firms."
            icon={
              <>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </>
            }
          />
          <FeatureCard
            title="Win more jobs"
            description="Fast, tidy quotes get back to customers while they're still keen — so you say yes to more work and chase fewer dead leads."
            icon={
              <>
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-border-subtle bg-background-elevated p-7 transition-colors hover:border-accent/40">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-black">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Mission                                                                 */
/* ----------------------------------------------------------------------- */

function Mission() {
  return (
    <section id="mission" className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-4xl px-6 py-20 text-center lg:py-28">
        <span className="text-sm font-semibold uppercase tracking-wider text-accent">
          Our mission
        </span>
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Built for the people who keep the country running
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Plumbers, electricians, builders and decorators are brilliant at their
          trade — not at paperwork. QuoteForge gives the self-employed and small
          trade teams the same tools the big firms use, so the work that wins
          jobs takes minutes instead of evenings. We&apos;re here to put time
          back in your day and money back in your pocket.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Pricing                                                                 */
/* ----------------------------------------------------------------------- */

function Pricing() {
  const included = [
    "Unlimited AI-generated quotes",
    "Professional, branded templates",
    "Itemised pricing & VAT handling",
    "Send quotes from any device",
    "Cancel anytime",
  ];

  return (
    <section id="pricing" className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mt-4 text-lg text-muted">
            One plan. Everything included. Less than the cost of a single
            call-out.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-background-elevated p-8 shadow-2xl shadow-black/40">
            <div className="bg-hero-glow pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                Founding member
              </span>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-semibold tracking-tight">£19</span>
                <span className="mb-1.5 text-muted">/month</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                Billed monthly. No contracts, no surprises.
              </p>

              <a
                href="#"
                className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-black transition-colors hover:bg-accent-hover"
              >
                Get started
              </a>

              <ul className="mt-8 space-y-3">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <svg
                      className="mt-0.5 shrink-0 text-accent"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Footer                                                                  */
/* ----------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <Logo />
        <p className="text-sm text-muted">
          © {new Date().getFullYear()} QuoteForge. Made for the trades.
        </p>
      </div>
    </footer>
  );
}
