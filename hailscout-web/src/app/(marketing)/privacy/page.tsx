import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";

export const metadata: Metadata = {
  title: "Privacy Policy · HailScout",
  description: "How HailScout collects, uses, and protects your data.",
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

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <div className="container max-w-2xl py-14">
      <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
        Legal
      </p>
      <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-2 font-mono-num text-xs text-muted-foreground">
        Last updated: June 2026
      </p>
      <div className="rule-atlas my-6" />

      <p className="text-sm text-foreground/85 leading-relaxed">
        HailScout provides hail-storm intelligence for roofing and restoration
        contractors via our website, web app, and mobile apps (the
        &quot;Service&quot;). This policy explains what we collect, why, and the
        choices you have.
      </p>

      <Section title="Information we collect">
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong>Account information</strong> — your name, email, and role,
            obtained when you sign in with Apple, Google, or Microsoft, or when
            your organization&apos;s administrator adds you. We never see your
            Apple/Google/Microsoft password.
          </li>
          <li>
            <strong>Location</strong> — in the mobile app, with your permission,
            we use your device location to center the map and to look up the
            hail size at your position. It is used in-app and not sold.
          </li>
          <li>
            <strong>Content you create</strong> — addresses you save to monitor,
            canvassing markers and notes, and reports you generate.
          </li>
          <li>
            <strong>Usage &amp; device data</strong> — basic logs and diagnostics
            needed to operate and secure the Service.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>
          To provide the Service (storm maps, address lookups, alerts, and
          reports), authenticate you, send the alerts you configure (email, SMS,
          or push), provide support, and keep the Service secure. We do
          <strong> not</strong> sell your personal information.
        </p>
      </Section>

      <Section title="Service providers we share with">
        <p>
          We share data only with vendors that help us run the Service, under
          contract: cloud hosting (Railway, Vercel), map tiles (MapTiler/Carto),
          message delivery for alerts you enable (Twilio for SMS, Resend for
          email), and — only if you use the optional photo-analysis feature —
          Anthropic for AI processing of the photo you submit. Storm data itself
          comes from public NOAA/NWS/SPC sources and is not personal to you.
        </p>
      </Section>

      <Section title="Data retention &amp; deletion">
        <p>
          We keep your data while your account is active. You can request
          permanent deletion of your account and associated data at any time at{" "}
          <a className="text-copper-700 underline" href="/account/delete">
            hailscout.net/account/delete
          </a>{" "}
          or by emailing{" "}
          <a className="text-copper-700 underline" href="mailto:privacy@hailscout.net">
            privacy@hailscout.net
          </a>
          . We complete deletions within 30 days, except records we are legally
          required to retain.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Access tokens are short-lived, refresh tokens are stored hashed and are
          revocable, and traffic is encrypted in transit. No system is perfectly
          secure, but we work to protect your data using industry-standard
          measures.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The Service is a business tool and is not directed to children under
          13, and we do not knowingly collect their data.
        </p>
      </Section>

      <Section title="Changes &amp; contact">
        <p>
          We&apos;ll update this page and the &quot;last updated&quot; date when
          this policy changes. Questions? Email{" "}
          <a className="text-copper-700 underline" href="mailto:privacy@hailscout.net">
            privacy@hailscout.net
          </a>
          .
        </p>
      </Section>
      </div>
      <SiteFooter />
    </main>
  );
}
