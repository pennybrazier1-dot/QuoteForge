import type { HomeSectionGroup } from "@/lib/home/home-data";
import { HomeGreeting } from "@/components/home/home-greeting";
import { HomeSection } from "@/components/home/home-section";

export function HomeScreen({
  fullName,
  notificationCount,
  groups,
}: {
  fullName: string | null;
  notificationCount: number;
  groups: HomeSectionGroup[];
}) {
  return (
    <div className="qf-home">
      <HomeGreeting fullName={fullName} notificationCount={notificationCount} />

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
