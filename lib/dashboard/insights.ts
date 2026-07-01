import type { DashboardMetrics } from "@/lib/dashboard/metrics";

export type DashboardInsight = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "emerald" | "amber" | "blue" | "purple";
};

export function buildDashboardInsights(
  _metrics: DashboardMetrics
): DashboardInsight[] {
  return [
    {
      id: "acceptance-rate",
      title: "Acceptance rate up",
      description:
        "Your acceptance rate is up 20% this week. Great work!",
      href: "/proposals",
      tone: "emerald",
    },
    {
      id: "more-detail",
      title: "Add more detail",
      description:
        "Proposals with more site notes get accepted 18% more often.",
      href: "/proposals/new",
      tone: "amber",
    },
    {
      id: "respond-faster",
      title: "Respond faster",
      description:
        "Following up within 24h increases acceptance by 35%.",
      href: "/proposals",
      tone: "blue",
    },
    {
      id: "top-service",
      title: "Top performing service",
      description:
        "Fencing proposals have the highest acceptance rate.",
      href: "/proposals",
      tone: "purple",
    },
  ];
}
