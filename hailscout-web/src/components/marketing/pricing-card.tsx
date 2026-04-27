import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface PricingCardProps {
  name: string;
  description: string;
  price: number | null;
  period: "monthly" | "annual";
  features: string[];
  highlighted?: boolean;
  comingSoon?: boolean;
}

export function PricingCard({
  name,
  description,
  price,
  period,
  features,
  highlighted = false,
  comingSoon = false,
}: PricingCardProps) {
  return (
    <Card className={highlighted ? "border-primary relative" : ""}>
      {highlighted && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Most Popular</Badge>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          {price !== null ? (
            <>
              <span className="text-4xl font-bold">${price}</span>
              <span className="text-muted-foreground">
                {period === "annual" ? "/year" : "/month"}
              </span>
            </>
          ) : (
            <span className="text-2xl font-semibold">Custom</span>
          )}
        </div>

        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <svg
                className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {!comingSoon ? (
          <Link href="/sign-up">
            <Button className="w-full" variant={highlighted ? "default" : "outline"}>
              Get Started
            </Button>
          </Link>
        ) : (
          <Button className="w-full" variant="outline" disabled>
            Coming Soon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
