// NOTE: Solid starting-point Terms of Service — reasonable coverage for a
// weather-data SaaS (accuracy disclaimer + liability limits are the load-
// bearing parts). Have counsel review + confirm the entity name, governing
// law, and billing terms before relying on it. Safe to ship as-is (far
// better than no ToS), then refine.
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";

export const metadata: Metadata = {
  title: "Terms of Service · Hail GPS",
  description: "The terms that govern your use of Hail GPS.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-medium tracking-tight-display text-foreground">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-foreground/85 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <div className="container max-w-2xl py-14">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
          Legal
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 font-mono-num text-xs text-muted-foreground">
          Last updated: July 2026
        </p>
        <div className="rule-atlas my-6" />

        <p className="text-sm text-foreground/85 leading-relaxed">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of
          Hail GPS&apos;s website, web application, and mobile apps, and the storm
          intelligence, maps, alerts, and reports they provide (together, the
          &quot;Service&quot;). By creating an account or using the Service, you agree to
          these Terms. If you don&apos;t agree, don&apos;t use the Service.
        </p>

        <Section title="Who can use the Service">
          <p>
            The Service is a business tool for roofing and restoration
            professionals. You must be at least 18 and able to form a binding
            contract. If you use the Service on behalf of a company, you represent
            that you&apos;re authorized to bind that company to these Terms, and
            &quot;you&quot; means that company.
          </p>
        </Section>

        <Section title="Accounts">
          <p>
            You&apos;re responsible for your account, for keeping your sign-in secure,
            and for everything done under it. Accounts are provisioned by your
            organization&apos;s administrator; you agree to provide accurate
            information and to notify us of any unauthorized use.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>break the law or infringe anyone&apos;s rights using the Service;</li>
            <li>
              resell, sublicense, scrape, or bulk-export the data except as your
              plan expressly allows;
            </li>
            <li>
              probe, disrupt, or circumvent the security or rate limits of the
              Service; or
            </li>
            <li>
              misrepresent the storm data — including to a customer, insurer, or in
              a claim — as a certified measurement of what it is not.
            </li>
          </ul>
        </Section>

        <Section title="Weather data &amp; accuracy — please read">
          <p>
            Hail GPS&apos;s hail sizes and swaths are <strong>estimates</strong>,
            derived primarily from radar (NOAA MRMS / NEXRAD) and, where available,
            ground reports (SPC and other sources). Radar-derived hail size is a
            modeled estimate, not a direct measurement, and coverage and accuracy
            vary by location, time, and distance from radar. Ground reports are
            third-party observations we don&apos;t independently verify.
          </p>
          <p>
            The Service is decision-support, <strong>not</strong> a guarantee that
            hail of any size did or did not occur at a given address, and it is
            <strong> not</strong> a substitute for a physical inspection, official
            weather warnings, or professional judgment. Do not rely on it for
            life-safety decisions. You are responsible for verifying conditions and
            for any representations you make to customers or third parties.
          </p>
        </Section>

        <Section title="Subscriptions &amp; billing">
          <p>
            Paid plans, prices, and features are described at sign-up or in your
            order. Unless stated otherwise, subscriptions renew for successive terms
            until cancelled, fees are billed in advance and are non-refundable except
            where required by law, and we may change pricing on renewal with notice.
            You can cancel effective at the end of your current term. Taxes are your
            responsibility.
          </p>
        </Section>

        <Section title="Our intellectual property">
          <p>
            The Service, software, and Hail GPS brand are ours (or our licensors&apos;)
            and are protected by law. We grant you a limited, non-exclusive,
            non-transferable right to use the Service per these Terms while your
            account is active. Underlying weather data originates from public
            NOAA/NWS/SPC sources and is not owned by us.
          </p>
        </Section>

        <Section title="Your content">
          <p>
            You keep ownership of the addresses, notes, photos, and reports you add.
            You grant us the limited rights needed to host and operate the Service
            for you. You&apos;re responsible for having the rights to any content you
            upload.
          </p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available,&quot; without
            warranties of any kind, express or implied, including merchantability,
            fitness for a particular purpose, non-infringement, and any warranty as
            to the accuracy, completeness, or availability of the data. We don&apos;t
            warrant the Service will be uninterrupted or error-free.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the fullest extent permitted by law, Hail GPS will not be liable for
            any indirect, incidental, special, consequential, or punitive damages, or
            for lost profits, revenue, data, or business, arising out of or relating
            to the Service or the data — including any decision made, or claim filed,
            in reliance on it. Our total liability for any claim will not exceed the
            amount you paid us for the Service in the 12 months before the event
            giving rise to the claim.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can stop using the Service anytime. We may suspend or terminate access
            if you breach these Terms or if needed to protect the Service or others.
            On termination, your right to use the Service ends; sections that by their
            nature should survive (e.g. IP, disclaimers, liability limits) survive.
          </p>
        </Section>

        <Section title="Changes to these Terms">
          <p>
            We may update these Terms; we&apos;ll change the &quot;last updated&quot; date and,
            for material changes, provide reasonable notice. Continuing to use the
            Service after changes take effect means you accept them.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These Terms are governed by the laws of the State of Colorado, USA,
            without regard to conflict-of-laws rules, and you agree to the exclusive
            jurisdiction of the state and federal courts located there.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a className="text-copper-700 underline" href="mailto:hello@hailgps.com">
              hello@hailgps.com
            </a>
            .
          </p>
        </Section>
      </div>
      <SiteFooter />
    </main>
  );
}
