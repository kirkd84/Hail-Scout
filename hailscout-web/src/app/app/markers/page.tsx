import { EmptyState } from "@/components/app/empty-state";
import { IconFlag } from "@/components/icons";

export default function MarkersPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-3xl py-10">
        <EmptyState
          icon={IconFlag}
          eyebrow="Coming soon"
          title="Canvassing markers"
          description="Drop a marker every time your crew knocks. Tag with status — lead, knocked, no answer, appointment, contract — and watch your sales funnel light up the atlas."
          primary={{ label: "Drop pins on the map", href: "/app/map" }}
          secondary={{ label: "Mobile app preview", href: "/compare" }}
        />
      </div>
    </div>
  );
}
