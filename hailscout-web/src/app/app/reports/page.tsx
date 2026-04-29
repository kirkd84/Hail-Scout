import { EmptyState } from "@/components/app/empty-state";
import { IconReport } from "@/components/icons";

export default function ReportsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-3xl py-10">
        <EmptyState
          icon={IconReport}
          eyebrow="Coming soon"
          title="Hail Impact Reports"
          description="Branded, AI-drafted reports for any address. Storm timeline, hail size, swath polygon, satellite proof links — generated in under 6 seconds. Optional meteorologist review for legal-grade claims."
          primary={{ label: "Try it on the map", href: "/app/map" }}
          secondary={{ label: "See sample report", href: "/compare" }}
        />
      </div>
    </div>
  );
}
