import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { SectionHeading, MarketingCard } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";

export const metadata: Metadata = {
  title: "Request access · Hail GPS",
  description:
    "Hail GPS is onboarding roofing and restoration crews. Request access and we'll get your team set up.",
};

const MAILTO =
  "mailto:hello@hailgps.com?subject=Hail%20GPS%20access%20request&body=Company%3A%0AName%3A%0APhone%3A%0AWhere%20you%20work%3A";

/**
 * Request-access landing — the front door of the funnel. Honest by
 * design: no trial/billing promises (billing doesn't exist yet), just
 * a clear "email us → we set you up → you're canvassing" path.
 */
export default function RequestAccessPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative max-w-6xl pb-16 pt-20 md:pb-24 md:pt-28">
          <div className="max-w-2xl">
            <p className="eyebrow">Request access</p>
            <h1 className="display-1 mt-3 text-foreground">
              Get your crew on the storm map.
            </h1>
            <p className="mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground text-pretty">
              Hail GPS is rolling out to roofing and restoration crews. Tell us
              about your company and we&apos;ll get your team set up with the
              live storm map, alerts on the addresses you care about, and
              canvassing tools.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={MAILTO}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700"
              >
                Email us to request access <span aria-hidden>&rarr;</span>
              </a>
              <Link
                href="/sign-in"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-card"
              >
                Already invited? Sign in
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Include your company name, where you work, and the best way to
              reach you. Or write us directly at{" "}
              <a className="text-copper-700 underline" href="mailto:hello@hailgps.com">
                hello@hailgps.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* What happens next */}
      <section className="border-t border-border bg-secondary/40 py-24 md:py-32">
        <div className="container max-w-6xl">
          <SectionHeading
            eyebrow="What happens next"
            title="Three steps between you and the map"
            lede="No forms, no self-serve maze. A person reads your email and gets your team running."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <StepCard
              n="01"
              title="We reply"
              body="Your email lands with the team, not a queue. We'll answer any questions about coverage in your area and what the rollout looks like."
            />
            <StepCard
              n="02"
              title="We set up your team"
              body="We create your company workspace and invite your crew — office staff, sales reps, and canvassers each get a sign-in."
            />
            <StepCard
              n="03"
              title="You're canvassing"
              body="Open the map, see where hail hit, and put your crew on the right streets with storm data to back up every knock."
            />
          </div>
        </div>
      </section>

      {/* Try it first */}
      <section className="border-t border-border py-24 md:py-32">
        <div className="container max-w-6xl">
          <SectionHeading
            eyebrow="While you wait"
            title="See the data for yourself"
            lede="The core lookup is public — no account needed."
          />
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-8">
            <Link
              href="/claim"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-copper-700 transition-colors hover:text-foreground"
            >
              Look up hail at any address <span aria-hidden>&rarr;</span>
            </Link>
            <Link
              href="/live"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-copper-700 transition-colors hover:text-foreground"
            >
              Watch the live storm map <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <MarketingCard className="p-7">
      <p className="font-mono-num text-xs text-copper" aria-hidden>
        {n}
      </p>
      <h3 className="mt-3 text-xl font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </MarketingCard>
  );
}
