import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AddressesPage() {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Monitored Addresses</CardTitle>
          <CardDescription>
            Coming soon — manage your monitored properties and receive alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>This feature is coming in Month 2.</p>
            <p className="text-sm mt-2">
              For now, use the map to search addresses and view storm history.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
