import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";

export const metadata: Metadata = {
  title: "Request access · HailScout",
  description:
    "HailScout is onboarding roofing and restoration crews. Request access and we'll get your team set up.",
};

export default function RequestAccessPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <div className="container max-w-2xl py-20">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
          Get started
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight-display text-foreground">
          Request access
        </h1>
        <p className="mt-4 text-base text-muted-foreground leading-relaxed">
          HailScout is rolling out to roofing and restoration crews. Tell us about
          your company and we&apos;ll get your team set up with the live storm map,
          alerts, and canvassing tools.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="mailto:hello@hailscout.net?subject=HailScout%20access%20request&body=Company%3A%0AName%3A%0APhone%3A%0AWhere%20you%20work%3A"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
          >
            Email us to get set up <span aria-hidden>→</span>
          </a>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-card"
          >
            Already invited? Sign in
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Prefer email? Reach us directly at{" "}
          <a className="text-copper-700 underline" href="mailto:hello@hailscout.net">
            hello@hailscout.net
          </a>
          .
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
