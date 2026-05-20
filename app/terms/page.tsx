import Link from "next/link"
import { MapPin, ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Terms of Service — Tripletto",
  description: "The rules of the road for using Tripletto.",
}

export default function TermsPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-serif text-xl tracking-tight">Tripletto</span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>

        <h1 className="font-serif text-4xl tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>

        <div className="mt-10 flex flex-col gap-8">
          <Section title="Welcome">
            <p>
              These Terms of Service govern your use of Tripletto (&ldquo;the Service&rdquo;). By
              signing up, you agree to these terms. If you don&apos;t agree, please don&apos;t use
              Tripletto.
            </p>
            <p>
              We&apos;ve tried to write this in plain language. If something isn&apos;t clear, email
              us at{" "}
              <a href="mailto:support@tripletto.app" className="text-primary hover:underline">
                support@tripletto.app
              </a>
              .
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>You may use Tripletto to plan trips for personal, family, or friend-group purposes. You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal purpose</li>
              <li>Upload content that is harmful, offensive, or infringes on others&apos; rights</li>
              <li>Attempt to access other users&apos; accounts or data without permission</li>
              <li>Use automated tools to scrape or abuse the Service</li>
              <li>Impersonate another person or organisation</li>
            </ul>
          </Section>

          <Section title="No commercial resale">
            <p>
              You may not resell, sublicense, or commercially exploit Tripletto or its features
              without our written permission. This includes building competing products using our
              platform or API.
            </p>
          </Section>

          <Section title="Your data">
            <p>
              <strong>You own your data.</strong> Trip information, itineraries, bookings, and
              expenses you create in Tripletto belong to you. We store it on your behalf and never
              claim ownership of your content.
            </p>
            <p>
              By using Tripletto, you grant us a limited licence to store and process your data
              solely to provide the Service. See our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              for details on how your data is handled.
            </p>
          </Section>

          <Section title="Service availability">
            <p>
              We work hard to keep Tripletto running reliably, but we make no guarantees of uptime
              or availability — especially on the Free tier. We may carry out maintenance, updates,
              or experience outages at any time.
            </p>
            <p>
              We will give reasonable notice of planned downtime where possible.
            </p>
          </Section>

          <Section title="Account termination">
            <p>
              You can stop using Tripletto and request account deletion at any time by emailing us
              at{" "}
              <a href="mailto:support@tripletto.app" className="text-primary hover:underline">
                support@tripletto.app
              </a>
              .
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms, with or
              without notice.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              Tripletto is provided &ldquo;as is&rdquo; without warranties of any kind. To the
              fullest extent permitted by law, we are not liable for any indirect, incidental, or
              consequential damages arising from your use of the Service — including loss of trip
              data, missed bookings, or travel disruptions.
            </p>
            <p>
              Our total liability to you for any claim is limited to the amount you paid us in the
              past 12 months (which is $0 for Free tier users).
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these Terms from time to time. We&apos;ll notify you by email of
              significant changes. Continued use of Tripletto after changes take effect means you
              accept the updated Terms.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These Terms are governed by the laws of Malaysia. Any disputes will be resolved in
              Malaysian courts.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these Terms? Email us at{" "}
              <a href="mailto:support@tripletto.app" className="text-primary hover:underline">
                support@tripletto.app
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-base leading-relaxed [&_a]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </div>
  )
}
