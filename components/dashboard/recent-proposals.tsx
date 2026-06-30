import { Card, CardHeading } from "@/components/dashboard/card";

type Proposal = {
  customer: string;
  job: string;
  amount: string;
  status: "Draft" | "Sent" | "Accepted";
};

const RECENT_PROPOSALS: Proposal[] = [
  {
    customer: "Sarah Whitfield",
    job: "Bathroom tap & valve replacement",
    amount: "£582.00",
    status: "Accepted",
  },
  {
    customer: "Tom Hargreaves",
    job: "Consumer unit upgrade",
    amount: "£940.00",
    status: "Sent",
  },
  {
    customer: "Grange Cafe",
    job: "Kitchen extractor install",
    amount: "£1,240.00",
    status: "Draft",
  },
];

const STATUS_STYLES: Record<Proposal["status"], string> = {
  Draft: "bg-white/5 text-muted",
  Sent: "bg-accent-soft text-accent",
  Accepted: "bg-emerald-500/10 text-emerald-400",
};

export function RecentProposals() {
  return (
    <Card>
      <CardHeading title="Recent proposals" hint="Last 3" />
      <ul className="mt-4 divide-y divide-border-subtle">
        {RECENT_PROPOSALS.map((proposal) => (
          <li
            key={proposal.customer}
            className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{proposal.customer}</p>
              <p className="truncate text-xs text-muted">{proposal.job}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-medium text-foreground/90">
                {proposal.amount}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[proposal.status]}`}
              >
                {proposal.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
