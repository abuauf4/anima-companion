import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ProblemListView } from "@/views/ProblemListView";
import { buildMetadata } from "@/lib/seo";

// /problem — shop by problem (concern-based browsing).
export const metadata: Metadata = buildMetadata({
  title: "Shop by Problem",
  description:
    "Temukan suplemen & vitamin hewan peliharaan berdasarkan masalah kesehatan: imunitas, nafsu makan, bulu & kulit, tulang & sendi, pencernaan, mata, recovery, dan vitamin harian.",
  path: "/problem",
  keywords: [
    "shop by problem",
    "suplemen imun",
    "suplemen nafsu makan",
    "suplemen bulu kulit",
    "suplemen tulang sendi",
    "suplemen pencernaan",
    "suplemen mata",
    "suplemen recovery",
    "vitamin harian",
  ],
});

export default function ProblemListPage() {
  return (
    <SiteShell>
      <ProblemListView />
    </SiteShell>
  );
}
