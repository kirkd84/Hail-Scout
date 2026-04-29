import { EmptyState } from "@/components/app/empty-state";
import { IconAddresses } from "@/components/icons";

export default function AddressesPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-3xl py-10">
        <EmptyState
          icon={IconAddresses}
          eyebrow="Coming soon"
          title="Monitored addresses"
          description="Pin your customers' addresses and get alerted the moment a hail event touches them. Save you a phone call and a truck roll."
          primary={{ label: "Use the map for now", href: "/app/map" }}
          secondary={{ label: "What's on the roadmap?", href: "/compare" }}
        />
      </div>
    </div>
  );
}
