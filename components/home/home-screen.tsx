import type { HomeSectionGroup } from "@/lib/home/home-data";
import type { HomeAttentionItem } from "@/lib/home/home-attention";
import { HomeGreeting } from "@/components/home/home-greeting";
import { HomeSection } from "@/components/home/home-section";

export function HomeScreen({
  fullName,
  attentionItems,
  groups,
}: {
  fullName: string | null;
  attentionItems: HomeAttentionItem[];
  groups: HomeSectionGroup[];
}) {
  return (
    <div className="qf-trader-page qf-home">
      <HomeGreeting fullName={fullName} attentionItems={attentionItems} />

      <div className="qf-home-stack">
        {groups.map((group) => (
          <div key={group.id} className="qf-home-group">
            <h2 className="qf-home-group-title">{group.title}</h2>
            {group.sections.map((section) => (
              <HomeSection key={section.id} section={section} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
