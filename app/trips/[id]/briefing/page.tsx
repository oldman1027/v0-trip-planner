import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { normalizeMembers } from "@/lib/types"
import { fmtCurrency, fmtDate, fmtDateShort, fmtTime, tripDays, CATEGORY_COLORS, C } from "@/lib/pdf/pdf-helpers"
import { geocodeDestination, fetchWeatherForecast } from "@/lib/weather"
import { groupTotal } from "@/lib/expense-utils"
import type { Activity, Booking, Expense, MemberWithProfile, Trip } from "@/lib/types"
import { PrintTrigger, PrintButton } from "./print-trigger"

export const dynamic = "force-dynamic"

const CAT_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  dining: "Dining",
  food: "Dining",
  experiences: "Experiences",
  activities: "Activities",
  other: "Other",
}

function isPrepaid(expense: Expense): boolean {
  return (
    expense.source_type === "booking" &&
    (expense.category === "accommodation" || expense.category === "transport")
  )
}

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: trip },
    { data: activitiesRaw },
    { data: bookingsRaw },
    { data: expensesRaw },
    { data: membersRaw },
    { data: membership },
  ] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("trip_id", id).order("position", { ascending: true }),
    supabase.from("bookings").select("*").eq("trip_id", id).order("booking_date", { ascending: true }),
    supabase.from("expenses").select("*").eq("trip_id", id).order("date", { ascending: true }),
    supabase
      .from("trip_members")
      .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
      .eq("trip_id", id),
    supabase.from("trip_members").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
  ])

  if (!trip) notFound()
  if (!membership) redirect(`/trips/${id}`)

  const t = trip as Trip
  const activities = (activitiesRaw ?? []) as Activity[]
  const bookings = (bookingsRaw ?? []) as Booking[]
  const expenses = (expensesRaw ?? []) as Expense[]
  const members = normalizeMembers(membersRaw)
  const partySize = members.length || 1
  const currency = t.default_currency ?? "USD"
  const days = tripDays(t.start_date, t.end_date)

  // Weather
  let weather = null
  if (t.destination) {
    const coords = await geocodeDestination(t.destination)
    if (coords) weather = await fetchWeatherForecast(coords.latitude, coords.longitude, t.destination)
  }

  // Accommodation bookings (check-in per day)
  const hotels = bookings.filter(b => b.type === "accommodation")
  const flights = bookings.filter(b => b.type === "transport")

  // Expenses by category
  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + groupTotal(e, partySize)
    return acc
  }, {} as Record<string, number>)
  const totalExpenses = expenses.reduce((s, e) => s + groupTotal(e, partySize), 0)

  // Cash planning
  const paidBookingIds = new Set(bookings.filter(b => b.payment_status === "paid").map(b => b.id))
  const cashExpenses = expenses.filter(e => !isPrepaid(e) && !(e.booking_id && paidBookingIds.has(e.booking_id)))
  const cashTotal = cashExpenses.reduce((s, e) => s + groupTotal(e, partySize), 0)
  const prepaidTotal = expenses.filter(e => isPrepaid(e)).reduce((s, e) => s + groupTotal(e, partySize), 0)

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const tripTitle = `${t.name} — Trip Briefing`

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; break-before: page; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: A4; margin: 20mm 18mm; }
        * { box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; color: ${C.body}; background: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 0.5px solid ${C.sandBorder}; padding: 6px 8px; font-size: 9px; text-align: left; vertical-align: top; }
        th { background: ${C.sandDark}; font-weight: 600; font-size: 9px; }
        tr:nth-child(even) td { background: ${C.sandMid}; }
      `}</style>

      <div style={{ maxWidth: 794, margin: "0 auto", background: "white", fontFamily: "Helvetica, Arial, sans-serif" }}>

        {/* ── PRINT TOOLBAR (screen only) ───────────────────────────────── */}
        <div className="no-print" style={{
          position: "sticky", top: 0, zIndex: 100, background: C.teal,
          padding: "12px 24px", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ color: "white", fontSize: 14, fontWeight: 600 }}>
            {tripTitle}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={`/trips/${id}`}
              style={{
                color: "rgba(255,255,255,0.8)", fontSize: 13, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              ← Back
            </a>
            <PrintButton
              style={{
                background: "white", color: C.teal, border: "none", borderRadius: 8,
                padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            />
          </div>
        </div>

        <div style={{ padding: "32px 32px 0" }}>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PAGE 1 — COVER                                                */}
          {/* ══════════════════════════════════════════════════════════════ */}

          {/* Cover header */}
          <div style={{
            background: C.teal, borderRadius: 12, padding: "32px 28px 24px",
            color: "white", marginBottom: 20,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {fmtDateShort(t.start_date)} – {fmtDateShort(t.end_date)}, {new Date(t.end_date).getFullYear()}
              {" · "}{days.length} {days.length === 1 ? "day" : "days"}
            </div>
            {t.destination && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>📍 {t.destination}</div>
            )}
          </div>

          {/* Members row */}
          {members.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.faint, marginBottom: 8 }}>
                Travellers
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {members.map(m => (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: C.teal, color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {(m.profile?.full_name ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 11, color: C.body }}>
                      {m.profile?.full_name ?? "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accommodation pills */}
          {hotels.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.faint, marginBottom: 8 }}>
                Accommodation
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {hotels.map(h => (
                  <div key={h.id} style={{
                    background: C.tealLight, border: `0.5px solid ${C.tealMuted}`,
                    borderRadius: 20, padding: "4px 12px", fontSize: 10, color: C.tealDark,
                  }}>
                    🏨 {h.title}
                    {h.booking_date ? ` · ${fmtDateShort(h.booking_date)}` : ""}
                    {h.check_out_date ? ` – ${fmtDateShort(h.check_out_date)}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather row */}
          {weather?.forecast && weather.forecast.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.faint, marginBottom: 8 }}>
                Weather Forecast
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {weather.forecast.slice(0, 8).map(f => (
                  <div key={f.date} style={{
                    background: C.sandDark, border: `0.5px solid ${C.sandBorder}`,
                    borderRadius: 8, padding: "5px 10px", fontSize: 9, color: C.body, textAlign: "center",
                  }}>
                    <div style={{ fontWeight: 600 }}>{fmtDateShort(f.date)}</div>
                    <div>{f.icon} {f.high}°F</div>
                    <div style={{ color: C.faint, fontSize: 8 }}>{f.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Costs summary + emergency row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <div style={{
              flex: 1, background: C.tealLight, border: `0.5px solid ${C.tealMuted}`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.muted, marginBottom: 6 }}>
                Trip Costs
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.tealDark }}>
                {fmtCurrency(totalExpenses, currency)}
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                Cash to exchange: {fmtCurrency(cashTotal, currency)}
              </div>
            </div>
            <div style={{
              flex: 1, background: "#FEF3C7", border: "0.5px solid #FDE68A",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#92400E", marginBottom: 6 }}>
                Emergency Numbers
              </div>
              <div style={{ fontSize: 10, color: "#92400E", lineHeight: 1.6 }}>
                🚔 Police: 191
                <br />🚑 Ambulance: 1669
                <br />🔥 Fire: 199
                <br />📞 Tourist Police: 1155
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ fontSize: 8, color: C.faint, borderTop: `0.5px solid ${C.sandBorder}`, paddingTop: 8, marginBottom: 32, display: "flex", justifyContent: "space-between" }}>
            <span>Tripletto · {t.name}</span>
            <span>Generated {generatedDate}</span>
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PAGES 2–N — ONE PAGE PER DAY                                  */}
          {/* ══════════════════════════════════════════════════════════════ */}

          {days.map((day, dayIdx) => {
            const dayActivities = activities
              .filter(a => a.day_date === day && !a.is_wishlist && !a.is_kiv)
              .sort((a, b) => {
                const blockOrder = { morning: 0, afternoon: 1, night: 2 }
                const ba = blockOrder[a.time_block ?? "morning"] ?? 0
                const bb = blockOrder[b.time_block ?? "morning"] ?? 0
                if (ba !== bb) return ba - bb
                return (a.start_time ?? "").localeCompare(b.start_time ?? "")
              })

            const dayExpenses = expenses.filter(e => e.date === day)
            const dayTotal = dayExpenses.reduce((s, e) => s + groupTotal(e, partySize), 0)
            const dayCash = dayExpenses
              .filter(e => !isPrepaid(e) && !(e.booking_id && paidBookingIds.has(e.booking_id)))
              .reduce((s, e) => s + groupTotal(e, partySize), 0)

            const hotelToday = hotels.find(h =>
              h.booking_date === day ||
              (h.booking_date && h.check_out_date && h.booking_date <= day && h.check_out_date > day)
            )

            const weatherDay = weather?.forecast?.find(f => f.date === day)
            const dayDateLabel = new Date(day + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "short", day: "numeric",
            })

            const dayNotes = dayActivities.filter(a => a.notes).map(a => a.notes!)

            return (
              <div key={day} className="page-break">
                {/* Day header bar */}
                <div style={{
                  background: C.teal, color: "white",
                  padding: "10px 16px", borderRadius: "8px 8px 0 0",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
                    DAY {dayIdx + 1} · {dayDateLabel.toUpperCase()}
                  </span>
                  {weatherDay && (
                    <span style={{ fontSize: 11, opacity: 0.85 }}>
                      {weatherDay.icon} {weatherDay.high}°F · {weatherDay.description}
                    </span>
                  )}
                </div>

                <div style={{ border: `0.5px solid ${C.sandBorder}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 14px", marginBottom: 20 }}>

                  {/* Hotel box */}
                  {hotelToday && (
                    <div style={{
                      background: C.tealLight, border: `0.5px solid ${C.tealMuted}`,
                      borderRadius: 6, padding: "8px 12px", marginBottom: 12,
                      fontSize: 10,
                    }}>
                      <span style={{ fontWeight: 700 }}>🏨 {hotelToday.title}</span>
                      {hotelToday.booking_date === day && hotelToday.check_in_time && (
                        <span style={{ color: C.muted }}> · Check-in: {fmtTime(hotelToday.check_in_time)}</span>
                      )}
                      {hotelToday.confirmation_number && (
                        <span style={{ color: C.muted }}> · Conf: {hotelToday.confirmation_number}</span>
                      )}
                      {typeof (hotelToday.details as Record<string, unknown> | null)?.address === "string" && (
                        <div style={{ color: C.muted, marginTop: 2, fontSize: 9 }}>
                          📍 {String((hotelToday.details as Record<string, unknown>).address)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activity table */}
                  {dayActivities.length > 0 ? (
                    <table style={{ marginBottom: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Time</th>
                          <th>Activity</th>
                          <th>Location</th>
                          <th style={{ width: 80, textAlign: "right" }}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayActivities.map(a => {
                          const dotColor = CATEGORY_COLORS[a.category] ?? C.faint
                          const cost = a.cost_amount && a.cost_amount > 0
                            ? fmtCurrency(a.cost_amount, a.cost_currency ?? currency)
                            : "—"
                          return (
                            <tr key={a.id}>
                              <td style={{ color: C.faint, whiteSpace: "nowrap" }}>
                                <span style={{
                                  display: "inline-block", width: 8, height: 8,
                                  borderRadius: "50%", background: dotColor,
                                  marginRight: 5, verticalAlign: "middle",
                                }} />
                                {a.start_time ? fmtTime(a.start_time) : "—"}
                                {a.end_time ? ` – ${fmtTime(a.end_time)}` : ""}
                              </td>
                              <td style={{ fontWeight: 500 }}>{a.title}</td>
                              <td style={{ color: C.faint }}>
                                {a.location ? a.location.split(",")[0] : "—"}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: cost !== "—" ? 600 : 400 }}>
                                {cost}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 10, color: C.faint, fontStyle: "italic", marginBottom: 12 }}>
                      No activities planned for this day.
                    </div>
                  )}

                  {/* Cash box */}
                  {(dayTotal > 0 || dayCash > 0) && (
                    <div style={{
                      background: C.tealLight, border: `0.5px solid ${C.tealMuted}`,
                      borderRadius: 6, padding: "7px 12px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: dayNotes.length > 0 ? 12 : 0,
                    }}>
                      <div style={{ fontSize: 10 }}>
                        💰 <strong>Cash for today:</strong> {fmtCurrency(dayCash, currency)}
                      </div>
                      {dayCash > 0 && (
                        <div style={{ fontSize: 9, color: C.muted }}>
                          Bring at least {fmtCurrency(Math.ceil(dayCash * 1.12), currency)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Day notes */}
                  {dayNotes.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {dayNotes.map((note, i) => (
                        <div key={i} style={{
                          fontSize: 9, color: C.muted, background: "#FFFBF0",
                          border: "0.5px solid #FDE68A", borderRadius: 6,
                          padding: "5px 10px", marginBottom: 4,
                        }}>
                          📌 {note}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Page footer */}
                <div style={{ fontSize: 8, color: C.faint, display: "flex", justifyContent: "space-between", borderTop: `0.5px solid ${C.sandBorder}`, paddingTop: 5, marginBottom: 28 }}>
                  <span>Tripletto · {t.name}</span>
                  <span>Day {dayIdx + 1} of {days.length}</span>
                </div>
              </div>
            )
          })}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* BOOKINGS SUMMARY PAGE                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}

          <div className="page-break">
            <SectionHeader>All Bookings</SectionHeader>

            {flights.length > 0 && (
              <>
                <SubHeader>✈ Flights & Transport</SubHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {flights.map(b => (
                    <BookingCard key={b.id} booking={b} currency={currency} />
                  ))}
                </div>
              </>
            )}

            {hotels.length > 0 && (
              <>
                <SubHeader>🏨 Accommodation</SubHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {hotels.map(b => (
                    <BookingCard key={b.id} booking={b} currency={currency} />
                  ))}
                </div>
              </>
            )}

            {bookings.filter(b => b.type !== "accommodation" && b.type !== "transport").length > 0 && (
              <>
                <SubHeader>Other Bookings</SubHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {bookings
                    .filter(b => b.type !== "accommodation" && b.type !== "transport")
                    .map(b => <BookingCard key={b.id} booking={b} currency={currency} />)}
                </div>
              </>
            )}

            <PageFooter name={t.name} label="Bookings" />
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* COSTS SUMMARY PAGE                                            */}
          {/* ══════════════════════════════════════════════════════════════ */}

          <div className="page-break">
            <SectionHeader>Trip Costs</SectionHeader>

            {/* Category table */}
            <SubHeader>By Category</SubHeader>
            <table style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Estimated</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(expensesByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amt]) => (
                    <tr key={cat}>
                      <td>
                        <span style={{
                          display: "inline-block", width: 8, height: 8,
                          borderRadius: "50%", background: CATEGORY_COLORS[cat] ?? C.faint,
                          marginRight: 6, verticalAlign: "middle",
                        }} />
                        {CAT_LABELS[cat] ?? cat}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmtCurrency(amt, currency)}
                      </td>
                    </tr>
                  ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: "right" }}>{fmtCurrency(totalExpenses, currency)}</td>
                </tr>
              </tbody>
            </table>

            {/* Cash planning */}
            <SubHeader>Cash Planning</SubHeader>
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {prepaidTotal > 0 && (
                  <tr>
                    <td>Pre-paid online</td>
                    <td style={{ textAlign: "right" }}>{fmtCurrency(prepaidTotal, currency)}</td>
                    <td style={{ color: C.faint, fontSize: 8 }}>Paid by card — no cash needed</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontWeight: 600 }}>Cash to exchange</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtCurrency(cashTotal, currency)}</td>
                  <td style={{ color: C.faint, fontSize: 8 }}>Local cash for activities, food, etc.</td>
                </tr>
                <tr>
                  <td>With 13% buffer</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {fmtCurrency(Math.ceil(cashTotal * 1.13), currency)}
                  </td>
                  <td style={{ color: C.faint, fontSize: 8 }}>Recommended amount to exchange</td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontSize: 8, color: C.faint, fontStyle: "italic", marginBottom: 20 }}>
              * Exchange rate estimate only. Verify current rates before exchanging currency.
            </div>

            <PageFooter name={t.name} label="Costs" />
          </div>

        </div>
      </div>
    </>
  )
}

// ── Small reusable layout components ─────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.teal, color: "white", padding: "10px 16px",
      borderRadius: "8px 8px 0 0", fontWeight: 700, fontSize: 14, marginBottom: 0,
    }}>
      {children}
    </div>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: 1, color: C.faint, marginTop: 16, marginBottom: 8,
      borderBottom: `0.5px solid ${C.sandBorder}`, paddingBottom: 4,
    }}>
      {children}
    </div>
  )
}

function PageFooter({ name, label }: { name: string; label: string }) {
  return (
    <div style={{
      fontSize: 8, color: C.faint, display: "flex", justifyContent: "space-between",
      borderTop: `0.5px solid ${C.sandBorder}`, paddingTop: 5, marginBottom: 28,
    }}>
      <span>Tripletto · {name}</span>
      <span>{label}</span>
    </div>
  )
}

function BookingCard({ booking: b, currency }: { booking: Booking; currency: string }) {
  const details = (b.details ?? {}) as Record<string, unknown>
  return (
    <div style={{
      border: `0.5px solid ${C.sandBorder}`, borderRadius: 6,
      padding: "10px 12px", background: "white",
    }}>
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: C.tealDark }}>
        {b.type === "transport" ? "✈" : b.type === "accommodation" ? "🏨" : "📋"} {b.title}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const, fontSize: 9, color: C.muted }}>
        {b.booking_date && <span>📅 {fmtDate(b.booking_date)}</span>}
        {b.departure_time && <span>🕐 Departs {fmtTime(b.departure_time)}</span>}
        {b.check_in_time && <span>Check-in {fmtTime(b.check_in_time)}</span>}
        {b.check_out_date && <span>Check-out {fmtDateShort(b.check_out_date)}{b.check_out_time ? ` · ${fmtTime(b.check_out_time)}` : ""}</span>}
        {b.amount && <span>{fmtCurrency(b.amount, b.currency ?? currency)}</span>}
        {typeof details.flight_number === "string" && <span>Flight: {details.flight_number}</span>}
        {typeof details.terminal === "string" && <span>Terminal: {details.terminal}</span>}
      </div>
      {b.confirmation_number && (
        <div style={{ marginTop: 6, fontSize: 10, color: C.tealDark }}>
          <strong>Confirmation:</strong>{" "}
          <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>
            {b.confirmation_number}
          </span>
        </div>
      )}
      {typeof details.address === "string" && (
        <div style={{ marginTop: 4, fontSize: 9, color: C.faint }}>📍 {details.address}</div>
      )}
    </div>
  )
}
