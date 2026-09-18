import type { HomeSectionGroup } from "@/lib/home/home-data";
import type { HomeAttentionItem } from "@/lib/home/home-attention";
import { HomeGreeting } from "@/components/home/home-greeting";
import { HomeSection } from "@/components/home/home-section";
import { HomeJobCompletedNotice } from "@/components/home/home-job-completed-notice";
import { HomeVisitBookedNotice } from "@/components/home/home-visit-booked-notice";

export function HomeScreen({
  fullName,
  attentionItems,
  groups,
  visitBooked = false,
  jobCompleted = false,
  completedCustomer = null,
}: {
  fullName: string | null;
  attentionItems: HomeAttentionItem[];
  groups: HomeSectionGroup[];
  visitBooked?: boolean;
  jobCompleted?: boolean;
  completedCustomer?: string | null;
}) {
  return (
    <div className="qf-trader-page qf-home">
      {visitBooked ? <HomeVisitBookedNotice /> : null}
      {jobCompleted ? (
        <HomeJobCompletedNotice customerName={completedCustomer} />
      ) : null}
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
