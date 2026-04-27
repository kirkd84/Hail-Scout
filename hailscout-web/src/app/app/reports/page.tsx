import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Hail Impact Reports</CardTitle>
          <CardDescription>
            Coming soon — generate branded reports for homeowners
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>This feature is coming in Month 2.</p>
            <p className="text-sm mt-2">
              AI-drafted reports with custom branding, owner contact info, and optional meteorologist review.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
