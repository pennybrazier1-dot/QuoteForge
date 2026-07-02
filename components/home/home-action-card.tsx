import Link from "next/link";
import type { HomeCard, HomeSectionTone } from "@/lib/home/home-data";
import {
  HomeCardContent,
  homeCardClassName,
} from "@/components/home/home-card-content";

export function HomeActionCard({
  card,
  sectionTone,
}: {
  card: HomeCard;
  sectionTone: HomeSectionTone;
}) {
  return (
    <Link href={card.href} className={homeCardClassName(sectionTone)}>
      <HomeCardContent card={card} sectionTone={sectionTone} />
    </Link>
  );
}
