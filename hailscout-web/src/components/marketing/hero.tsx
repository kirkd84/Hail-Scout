import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
      <div className="container flex max-w-4xl flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
          AI-native hail mapping for roofers
        </h1>
        <p className="text-xl text-muted-foreground sm:text-2xl">
          Find storm-damaged properties in minutes. $899/yr nationwide.
        </p>
        <div className="space-x-4">
          <Link href="/sign-up">
            <Button size="lg">
              Start Free Trial
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline">
              View Pricing
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          No credit card required. Real-time swaths for TX, OK, KS, CO, MO, NE, IA and nationwide historical archive.
        </p>
      </div>
    </section>
  );
}
