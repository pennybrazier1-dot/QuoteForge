import type { ReactNode } from "react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <JobToolkit />
        <Tradespeople />
        <HowItWorks />
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
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Log In
          </a>
          <a
            href="/signup"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Start Free Trial
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
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built for independent tradespeople
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Finish work.
            <br />
            <span className="text-accent">Not paperwork.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Quotes, invoices and paperwork sorted in minutes, so you can get
            back to what matters.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-black transition-colors hover:bg-accent-hover"
            >
              Start Your 14-Day Free Trial
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border-subtle px-7 text-base font-medium text-foreground transition-colors hover:bg-background-elevated"
            >
              See How It Works
            </a>
          </div>

          <p className="mt-5 text-sm text-muted">
            No credit card required • Cancel anytime
          </p>
        </div>

        <ProposalPreview />
      </div>
    </section>
  );
}

function ProposalPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-accent/10 blur-2xl" />

      <div className="relative rounded-2xl border border-border-subtle bg-background-elevated shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3.5">
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="ml-3 text-xs text-muted">Quote #1042 — Ready to send</span>
        </div>

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
            Sorted in minutes — ready to send
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
/* Everything you need for every job                                       */
/* ----------------------------------------------------------------------- */

const JOB_TOOLKIT = [
  {
    title: "Quotes",
    description:
      "Professional quotes ready in minutes — clear pricing your customers understand.",
    icon: (
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    ),
  },
  {
    title: "Invoices",
    description:
      "Turn accepted work into invoices without starting from scratch.",
    icon: (
      <>
        <path d="M4 2v20h16" />
        <path d="M8 6h8M8 10h8M8 14h5" />
      </>
    ),
  },
  {
    title: "Customers",
    description:
      "Keep every customer's details, history and jobs in one place.",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </>
    ),
  },
  {
    title: "Calendar",
    description:
      "See what's on today and what's coming up — at a glance.",
    icon: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </>
    ),
  },
  {
    title: "Materials",
    description:
      "Track what you need for each job so nothing gets forgotten on site.",
    icon: (
      <>
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
      </>
    ),
  },
  {
    title: "Communication",
    description:
      "Send quotes and updates from your phone — no chasing through texts and emails.",
    icon: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
  },
] as const;

function JobToolkit() {
  return (
    <section id="features" className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need for every job
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            One place for the paperwork that comes with every job — so you spend
            less time organising and more time earning.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {JOB_TOOLKIT.map((item) => (
            <FeatureCard
              key={item.title}
              title={item.title}
              description={item.description}
              icon={item.icon}
            />
          ))}
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
/* Built for tradespeople                                                  */
/* ----------------------------------------------------------------------- */

function Tradespeople() {
  const trades = [
    "Builders",
    "Gardeners",
    "Electricians",
    "Window cleaners",
    "Carpet fitters",
    "Plumbers",
    "Decorators",
    "Landscapers",
  ];

  return (
    <section className="border-t border-border-subtle bg-background-elevated/30">
      <div className="mx-auto w-full max-w-4xl px-6 py-20 text-center lg:py-28">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Built for the way tradespeople actually work
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          QuoteForge is designed for independent tradespeople — on the tools all
          day, catching up on paperwork in the van or at the kitchen table. Save
          time, stay organised, and look professional without becoming an
          office worker.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Whether you&apos;re a builder, gardener, electrician, window cleaner,
          carpet fitter or dozens of other trades — if you work for yourself,
          QuoteForge is built for you.
        </p>

        <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2">
          {trades.map((trade) => (
            <li
              key={trade}
              className="rounded-full border border-border-subtle bg-background-elevated px-4 py-2 text-sm font-medium text-foreground/90"
            >
              {trade}
            </li>
          ))}
          <li className="rounded-full border border-border-subtle bg-accent-soft px-4 py-2 text-sm font-medium text-accent">
            And many more
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* How it works                                                            */
/* ----------------------------------------------------------------------- */

const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Describe the job",
    description:
      "Tell us what the work involves — in your own words, from site or the van.",
  },
  {
    step: "2",
    title: "We organise everything",
    description:
      "QuoteForge turns your notes into a clear, professional quote with pricing laid out.",
  },
  {
    step: "3",
    title: "Send your quote",
    description:
      "Review, tweak if you need to, and send — your customer gets a proper proposal.",
  },
  {
    step: "4",
    title: "Get the job done",
    description:
      "Track what's waiting, what's accepted, and move on to the next job.",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted">
            Four simple steps. No training required.
          </p>
        </div>

        <ol className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2">
          {WORKFLOW_STEPS.map((item) => (
            <li key={item.step} className="relative flex gap-5">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-black"
                aria-hidden="true"
              >
                {item.step}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Pricing                                                                 */
/* ----------------------------------------------------------------------- */

function Pricing() {
  const included = [
    "Quotes, customers and calendar",
    "Professional, branded documents",
    "Itemised pricing and VAT",
    "Works on your phone",
    "14-day free trial included",
    "Cancel anytime",
  ];

  return (
    <section id="pricing" className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Honest pricing
          </h2>
          <p className="mt-4 text-lg text-muted">
            One simple plan. 14-day free trial. No hidden fees. No long
            contracts.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-background-elevated p-8 shadow-2xl shadow-black/40">
            <div className="bg-hero-glow pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                14-day free trial
              </span>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-semibold tracking-tight">£19</span>
                <span className="mb-1.5 text-muted">/month</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                After your trial. Billed monthly. Cancel anytime.
              </p>

              <a
                href="/signup"
                className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-black transition-colors hover:bg-accent-hover"
              >
                Start Your 14-Day Free Trial
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
          © {new Date().getFullYear()} QuoteForge. Finish work. Not paperwork.
        </p>
      </div>
    </footer>
  );
}
