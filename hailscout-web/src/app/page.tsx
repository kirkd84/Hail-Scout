import { Hero } from "@/components/marketing/hero";
import { Footer } from "@/components/marketing/footer";

export default function Home() {
  return (
    <main>
      <Hero />

      {/* Features Section */}
      <section className="py-12 md:py-24 lg:py-32 border-t">
        <div className="container max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Real-time Detection</h3>
              <p className="text-muted-foreground">
                See hail swaths on the map within minutes of impact. Direct integration with NOAA MRMS data.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Historical Archive</h3>
              <p className="text-muted-foreground">
                Access 15 years of hail history (2011–present) for any address nationwide. Never miss a historical opportunity.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">AI-Drafted Reports</h3>
              <p className="text-muted-foreground">
                Generate branded Hail Impact Reports in seconds. On-demand meteorologist review available for legal-tier claims.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-24 lg:py-32 bg-primary text-primary-foreground">
        <div className="container max-w-2xl text-center space-y-4">
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to transform your storm workflow?
          </h2>
          <p className="text-lg opacity-90">
            Get 14 days free. No credit card required.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
