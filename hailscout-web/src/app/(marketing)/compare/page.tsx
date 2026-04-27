import { FEATURE_COMPARISON } from "@/lib/constants";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { Footer } from "@/components/marketing/footer";

export default function ComparePage() {
  return (
    <main>
      <section className="py-12 md:py-24 lg:py-32">
        <div className="container max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl font-bold md:text-5xl">
              HailScout vs. Competitors
            </h1>
            <p className="text-xl text-muted-foreground">
              Side-by-side feature comparison. We match the power of HailTrace and IHM at a fraction of the cost.
            </p>
          </div>

          <div className="bg-card rounded-lg border p-8 overflow-x-auto">
            <ComparisonTable rows={FEATURE_COMPARISON.rows} />
          </div>

          {/* Highlights */}
          <div className="grid gap-8 md:grid-cols-2 mt-12 pt-12 border-t">
            <div>
              <h3 className="text-xl font-bold mb-4">Why Choose HailScout?</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>$899/yr vs. $3-8K (HailTrace) or $1,999 (IHM)</span>
                </li>
                <li className="flex gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>First-class mobile apps for iOS and Android</span>
                </li>
                <li className="flex gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>AI-drafted Hail Impact Reports (on demand)</span>
                </li>
                <li className="flex gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>API-first architecture for your CRM</span>
                </li>
                <li className="flex gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Unlimited team members (same cost)</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4">What Others Offer</h3>
              <p className="text-muted-foreground mb-4">
                <strong>HailTrace ($3-8K/yr):</strong> Established player. Good for large national contractors. Steep pricing. Android app reputation.
              </p>
              <p className="text-muted-foreground">
                <strong>IHM ($1,999/yr):</strong> Good value at their price point. Limited mobile experience. Limited integrations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
