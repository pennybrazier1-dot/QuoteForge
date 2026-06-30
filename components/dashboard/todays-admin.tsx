import { Card, CardHeading } from "@/components/dashboard/card";

const TASKS = [
  "Create 2 proposals",
  "Follow up 1 customer",
  "Review accepted proposal",
];

export function TodaysAdmin() {
  return (
    <Card>
      <CardHeading title="Today's admin" hint={`${TASKS.length} to do`} />
      <ul className="mt-4 space-y-2.5">
        {TASKS.map((task) => (
          <li
            key={task}
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-background px-4 py-3"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-background-elevated">
              <span className="h-2 w-2 rounded-sm bg-accent" />
            </span>
            <span className="text-sm text-foreground/90">{task}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
