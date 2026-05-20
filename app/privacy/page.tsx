import Link from "next/link"
import { MapPin, ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Privacy Policy — Tripletto",
  description: "How Tripletto collects, uses, and protects your data.",
}

export default function PrivacyPage() {
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

        <h1 className="font-serif text-4xl tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>

        <div className="prose-tripletto mt-10 flex flex-col gap-8">
          <Section title="The short version">
            <p>
              We collect the minimum data needed to run Tripletto. We don&apos;t sell your data, we
              don&apos;t run ads, and we don&apos;t share it with anyone except the services that
              power the app (listed below). You own your data and can ask us to delete it at any
              time.
            </p>
          </Section>

          <Section title="What we collect">
            <ul>
              <li>
                <strong>Email address</strong> — used to send you a magic sign-in link. We don&apos;t
                send marketing emails unless you opt in.
              </li>
              <li>
                <strong>Trip data</strong> — trip name, destination, dates, itinerary activities,
                bookings, and expenses that you and your collaborators add to Tripletto.
              </li>
              <li>
                <strong>Profile information</strong> — your display name and optional profile photo,
                which are visible to your trip collaborators.
              </li>
              <li>
                <strong>Uploaded files</strong> — any attachments (PDFs, images) you upload to
                bookings are stored securely in our file storage.
              </li>
              <li>
                <strong>Usage data</strong> — anonymous analytics (page views, feature usage) via
                Vercel Analytics. No personal identifiers are attached.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <p>Your data is used solely to provide the Tripletto service:</p>
            <ul>
              <li>Authenticate you via magic link emails</li>
              <li>Store and display your trip data to you and your invited collaborators</li>
              <li>Power AI trip planning suggestions (your trip details are sent to Google&apos;s Gemini API to generate suggestions)</li>
              <li>Display activity locations on maps</li>
            </ul>
            <p>We do not use your data to train AI models.</p>
          </Section>

          <Section title="Third-party services">
            <p>Tripletto is built on the following services, each with their own privacy policies:</p>
            <ul>
              <li>
                <strong>Supabase</strong> — database, authentication, and file storage. Your data is
                stored in Supabase&apos;s infrastructure.
              </li>
              <li>
                <strong>Google Maps API</strong> — used to power location autocomplete and map views.
                Location searches are sent to Google.
              </li>
              <li>
                <strong>Google Gemini API</strong> — used for AI trip planning. Trip details
                (destination, dates, activities) are sent to Google to generate suggestions.
              </li>
              <li>
                <strong>Brevo (Sendinblue)</strong> — used to send transactional emails (magic links,
                invitations).
              </li>
              <li>
                <strong>Vercel</strong> — hosting and analytics platform.
              </li>
            </ul>
          </Section>

          <Section title="Data retention">
            <p>
              We keep your data for as long as your account is active. If you stop using Tripletto,
              your data remains stored until you request deletion.
            </p>
            <p>
              To delete your account and all associated data, email us at{" "}
              <a href="mailto:hello.tripletto@gmail.com" className="text-primary hover:underline">
                hello.tripletto@gmail.com
              </a>{" "}
              with the subject line &ldquo;Delete my account&rdquo;. We&apos;ll process your request
              within 14 days.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              Tripletto uses a single session cookie to keep you signed in. We do not use
              advertising or tracking cookies.
            </p>
          </Section>

          <Section title="Your rights">
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your trip data</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:hello.tripletto@gmail.com" className="text-primary hover:underline">
                hello.tripletto@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="Malaysia PDPA compliance">
            <p>
              Tripletto is operated from Malaysia and we take our obligations under the{" "}
              <strong>Personal Data Protection Act 2010 (PDPA)</strong> seriously. We collect only
              the minimum data necessary, process it only for the purposes stated in this policy, and
              provide you with access and correction rights. If you have concerns about how we handle
              your personal data, you may contact the Department of Personal Data Protection Malaysia
              (JPDP).
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If we make significant changes to this policy, we&apos;ll notify you by email. Minor
              updates will be reflected here with an updated date at the top.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email us at{" "}
              <a href="mailto:hello.tripletto@gmail.com" className="text-primary hover:underline">
                hello.tripletto@gmail.com
              </a>
              . We&apos;re a small team and we read every message.
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
      <div className="flex flex-col gap-3 text-base leading-relaxed text-muted-foreground [&_a]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </div>
  )
}
