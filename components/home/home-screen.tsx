import type { HomeSection as HomeSectionData } from "@/lib/home/home-data";
import { HomeGreeting } from "@/components/home/home-greeting";
import { HomeSection } from "@/components/home/home-section";

export function HomeScreen({
  fullName,
  notificationCount,
  sections,
}: {
  fullName: string | null;
  notificationCount: number;
  sections: HomeSectionData[];
}) {
  return (
    <div className="qf-home">
      <HomeGreeting fullName={fullName} notificationCount={notificationCount} />

      <div className="qf-home-stack">
        {sections.map((section) => (
          <HomeSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
