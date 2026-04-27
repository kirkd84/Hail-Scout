import { Footer } from "@/components/marketing/footer";
import { PricingCard } from "@/components/marketing/pricing-card";

export default function PricingPage() {
  return (
    <main>
      <section className="py-12 md:py-24 lg:py-32">
        <div className="container max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl font-bold md:text-5xl">Simple, Transparent Pricing</h1>
            <p className="text-xl text-muted-foreground">
              One flat rate. Unlimited users, unlimited storms, nationwide coverage.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 mb-12">
            <PricingCard
              name="Starter"
              description="For small roofing contractors"
              price={899}
              period="annual"
              features={[
                "Nationwide hail mapping (real-time + archive)",
                "Unlimited team members",
                "Address search and monitoring",
                "Branded Hail Impact Reports (AI-generated)",
                "Basic canvassing markers",
                "Email support",
              ]}
              highlighted
            />

            <PricingCard
              name="Pro"
              description="For growth-stage contractors"
              price={1499}
              period="annual"
              features={[
                "Everything in Starter",
                "Photo damage AI triage",
                "Advanced analytics dashboard",
                "CRM integrations (AccuLynx, JobNimbus)",
                "Priority support",
                "Custom branding",
              ]}
              comingSoon
            />

            <PricingCard
              name="Enterprise"
              description="For larger operations"
              price={null}
              period="annual"
              features={[
                "Everything in Pro",
                "Dedicated meteorologist review",
                "White-label option",
                "Custom integrations",
                "SLA guarantee",
                "Phone + email support",
              ]}
              comingSoon
            />
          </div>

          {/* FAQ Section */}
          <div className="max-w-2xl mx-auto space-y-6 border-t pt-12">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Can I try for free?</h3>
                <p className="text-muted-foreground">
                  Yes! Get 14 days full access to Starter features with no credit card required.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How many team members can I invite?</h3>
                <p className="text-muted-foreground">
                  Unlimited. Add as many users as you need to your organization at no extra cost.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">What's included in a "Hail Impact Report"?</h3>
                <p className="text-muted-foreground">
                  AI-drafted reports include storm timeline, hail size estimates, affected properties, and owner contact info (Cole-enriched). Optional meteorologist review available for legal disputes.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Do you offer annual discounts?</h3>
                <p className="text-muted-foreground">
                  Pricing shown is annual. Contact us for volume discounts and multi-year commitments.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How accurate is the hail detection?</h3>
                <p className="text-muted-foreground">
                  We use NOAA MRMS (the same source as IHM and HailTrace) for real-time swaths. Accuracy is 95%+ for hail areas, though individual hail size estimates have ±0.25" uncertainty. AI + on-demand meteorologist review available for critical claims.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
