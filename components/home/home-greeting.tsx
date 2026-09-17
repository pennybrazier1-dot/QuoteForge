import { HomeAttentionBell } from "@/components/home/home-attention-bell";
import type { HomeAttentionItem } from "@/lib/home/home-attention";
import { getGreetingName, getTimeGreeting } from "@/lib/home/home-data";

export function HomeGreeting({
  fullName,
  attentionItems,
}: {
  fullName: string | null;
  attentionItems: HomeAttentionItem[];
}) {
  const greeting = getTimeGreeting();
  const name = getGreetingName(fullName);

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <header className="qf-home-header">
      <div className="qf-home-header-top">
        <div className="qf-home-header-copy">
          <h1 className="qf-home-greeting-title">
            {greeting},{" "}
            <span className="qf-home-greeting-name">{name}</span>
          </h1>
          <p className="qf-home-greeting-date">{today}</p>
        </div>

        <HomeAttentionBell items={attentionItems} />
      </div>

      <h2 className="qf-home-question">
        What do you need to get done today?
      </h2>
    </header>
  );
}
