import nodemailer from "nodemailer"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASSWORD,
  },
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://v0-tripletto.vercel.app"

export async function sendTripInvitationEmail({
  toEmail,
  inviterName,
  tripName,
  tripId,
  isNewUser = false,
}: {
  toEmail: string
  inviterName: string
  tripName: string
  tripId: string
  isNewUser?: boolean
}) {
  const safeName = escapeHtml(inviterName)
  const safeTrip = escapeHtml(tripName)
  const tripUrl = `${siteUrl}/trips/${tripId}`
  const ctaUrl = isNewUser ? `${siteUrl}/login?next=/trips/${tripId}` : tripUrl
  const ctaLabel = isNewUser ? "Sign up &amp; view trip" : "View trip"
  const subtitle = isNewUser
    ? `Create a free Tripletto account to join the trip.`
    : `You now have access to view and edit the trip.`

  await transporter.sendMail({
    from: '"Tripletto" <noreply@tripletto.app>',
    to: toEmail,
    subject: `${inviterName} invited you to join ${tripName}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f5f0;padding:32px;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #e8e0d6;">
          <h2 style="margin:0 0 12px;font-size:26px;color:#1f2933;">
            You're invited to join ${safeTrip}!
          </h2>
          <p style="font-size:15px;color:#6b7280;line-height:1.6;">
            <strong style="color:#1f2933;">${safeName}</strong> has invited you to collaborate on their trip.
            ${subtitle}
          </p>
          <a href="${ctaUrl}"
             style="display:inline-block;background:#6D8F87;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:12px;margin:16px 0;">
            ${ctaLabel}
          </a>
          <p style="font-size:13px;color:#9ca3af;margin-top:24px;">
            If you didn't expect this invitation, you can safely ignore it.
          </p>
        </div>
        <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#9ca3af;">
          Tripletto &middot; Trip Planner
        </p>
      </div>
    `,
  })
}
