import type { TradeServiceRequest } from "@/lib/admin/types";

export const PLACEHOLDER_TRADE_SERVICE_REQUESTS: TradeServiceRequest[] = [
  {
    id: "req-1",
    requestedName: "Asbestos removal",
    description: "Licensed removal and disposal for garage roof sheets.",
    reason: "We get asked about this monthly on older properties.",
    requestedBy: "Smith Building Ltd",
    status: "new",
  },
  {
    id: "req-2",
    requestedName: "EV charger installation",
    description: "Home wallbox installs with consumer unit checks.",
    reason: "Growing demand from customers with new electric cars.",
    requestedBy: "Jones Electrical",
    status: "reviewing",
  },
  {
    id: "req-3",
    requestedName: "Scaffolding",
    description: "Temporary scaffolding for exterior painting jobs.",
    reason: "We subcontract today but would like a proper category.",
    requestedBy: "Bright Decorators",
    status: "approved",
  },
  {
    id: "req-4",
    requestedName: "Pest control",
    description: "Rodent and insect treatment for domestic properties.",
    reason: "Not a trade we plan to offer.",
    requestedBy: "Green Gardens",
    status: "rejected",
  },
];
