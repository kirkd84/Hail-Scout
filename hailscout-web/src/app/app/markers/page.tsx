import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarkersPage() {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Canvassing Markers</CardTitle>
          <CardDescription>
            Coming soon — manage field canvassing status and lead tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>This feature is coming in Month 3.</p>
            <p className="text-sm mt-2">
              Mobile app will have full canvassing support with marker statuses: lead, knocked, appointment, contract.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
