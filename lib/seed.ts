import { addDays, nextMonday } from "date-fns"
import { formatDateOnly } from "./dates"
import type { TimeBlock } from "./types"

const TOKYO_COVER =
  "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80"

type SeedActivity = {
  dayOffset: number
  time_block: TimeBlock
  position: number
  title: string
  location: string
  start_time?: string
  end_time?: string
  notes?: string
  cost_amount?: number
  photo_url: string
}

const SEED_ACTIVITIES: SeedActivity[] = [
  // Day 1 — Arrival
  {
    dayOffset: 0,
    time_block: "morning",
    position: 0,
    title: "Land at Haneda Airport",
    location: "Haneda Airport, Tokyo",
    start_time: "09:30",
    end_time: "11:00",
    notes: "Pick up Suica IC cards at the JR counter.",
    photo_url:
      "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 0,
    time_block: "afternoon",
    position: 0,
    title: "Check in at Hotel Gracery Shinjuku",
    location: "Shinjuku, Tokyo",
    start_time: "15:00",
    photo_url:
      "https://images.unsplash.com/photo-1554188248-986adbb73be4?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 0,
    time_block: "night",
    position: 0,
    title: "Ramen at Ichiran Shinjuku",
    location: "Shinjuku, Tokyo",
    start_time: "19:30",
    end_time: "21:00",
    cost_amount: 38,
    photo_url:
      "https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=600&q=80",
  },
  // Day 2 — Asakusa
  {
    dayOffset: 1,
    time_block: "morning",
    position: 0,
    title: "Senso-ji Temple",
    location: "Asakusa, Tokyo",
    start_time: "09:00",
    end_time: "11:00",
    notes: "Try freshly-grilled senbei on Nakamise-dori.",
    photo_url:
      "https://images.unsplash.com/photo-1583400392308-2c4c4c4f73c1?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 1,
    time_block: "afternoon",
    position: 0,
    title: "Sumida River cruise to Odaiba",
    location: "Asakusa Pier",
    start_time: "13:30",
    end_time: "15:00",
    cost_amount: 22,
    photo_url:
      "https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 1,
    time_block: "night",
    position: 0,
    title: "Yakitori in Omoide Yokocho",
    location: "Shinjuku, Tokyo",
    start_time: "20:00",
    photo_url:
      "https://images.unsplash.com/photo-1526318472351-c75fcf070305?auto=format&fit=crop&w=600&q=80",
  },
  // Day 3 — teamLab + Shibuya
  {
    dayOffset: 2,
    time_block: "morning",
    position: 0,
    title: "teamLab Planets",
    location: "Toyosu, Tokyo",
    start_time: "10:00",
    end_time: "12:00",
    cost_amount: 32,
    notes: "Wear shorts you can roll up — water rooms!",
    photo_url:
      "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 2,
    time_block: "afternoon",
    position: 0,
    title: "Shibuya Sky observation deck",
    location: "Shibuya Scramble Square",
    start_time: "15:30",
    end_time: "17:00",
    cost_amount: 25,
    photo_url:
      "https://images.unsplash.com/photo-1549693578-d683be217e58?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 2,
    time_block: "night",
    position: 0,
    title: "Family dinner — sushi at Numazuko",
    location: "Shinjuku, Tokyo",
    start_time: "19:30",
    end_time: "21:30",
    cost_amount: 95,
    notes: "Reservation under family name. Window table.",
    photo_url:
      "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=600&q=80",
  },
  // Day 4 — Harajuku & Meiji
  {
    dayOffset: 3,
    time_block: "morning",
    position: 0,
    title: "Meiji Jingu shrine walk",
    location: "Yoyogi, Tokyo",
    start_time: "09:30",
    end_time: "11:00",
    photo_url:
      "https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 3,
    time_block: "afternoon",
    position: 0,
    title: "Takeshita Street + crepes",
    location: "Harajuku, Tokyo",
    start_time: "13:00",
    photo_url:
      "https://images.unsplash.com/photo-1572450337820-685e3712f2ce?auto=format&fit=crop&w=600&q=80",
  },
  // Day 5 — Day trip Hakone
  {
    dayOffset: 4,
    time_block: "morning",
    position: 0,
    title: "Train to Hakone",
    location: "Shinjuku → Hakone-Yumoto",
    start_time: "08:00",
    end_time: "10:00",
    cost_amount: 60,
    photo_url:
      "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 4,
    time_block: "afternoon",
    position: 0,
    title: "Lake Ashi pirate cruise + Mt. Fuji view",
    location: "Hakone",
    start_time: "13:00",
    end_time: "15:30",
    photo_url:
      "https://images.unsplash.com/photo-1490375622188-fae20cb008ab?auto=format&fit=crop&w=600&q=80",
  },
  // Day 6 — Akihabara + Ueno
  {
    dayOffset: 5,
    time_block: "morning",
    position: 0,
    title: "Ueno Park + zoo",
    location: "Ueno, Tokyo",
    start_time: "10:00",
    cost_amount: 14,
    photo_url:
      "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 5,
    time_block: "afternoon",
    position: 0,
    title: "Akihabara electronics + arcades",
    location: "Akihabara, Tokyo",
    start_time: "14:00",
    photo_url:
      "https://images.unsplash.com/photo-1542931287-023b922fa89b?auto=format&fit=crop&w=600&q=80",
  },
  // Day 7 — Departure
  {
    dayOffset: 6,
    time_block: "morning",
    position: 0,
    title: "Tsukiji outer market breakfast",
    location: "Tsukiji, Tokyo",
    start_time: "08:30",
    end_time: "10:00",
    cost_amount: 30,
    photo_url:
      "https://images.unsplash.com/photo-1535399831218-d4ed847ffaa5?auto=format&fit=crop&w=600&q=80",
  },
  {
    dayOffset: 6,
    time_block: "afternoon",
    position: 0,
    title: "Fly home from Haneda",
    location: "Haneda Airport, Tokyo",
    start_time: "16:00",
    photo_url:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80",
  },
]

export function getSeed(today: Date = new Date()) {
  const start = nextMonday(today)
  const startStr = formatDateOnly(start)
  const endStr = formatDateOnly(addDays(start, 6))

  const activities = SEED_ACTIVITIES.map((a) => ({
    day_date: formatDateOnly(addDays(start, a.dayOffset)),
    time_block: a.time_block,
    position: a.position,
    title: a.title,
    location: a.location,
    start_time: a.start_time ?? null,
    end_time: a.end_time ?? null,
    notes: a.notes ?? null,
    cost_amount: a.cost_amount ?? null,
    cost_currency: "USD",
    photo_url: a.photo_url,
  }))

  const bookings = [
    {
      type: "accommodation" as const,
      title: "Hotel Gracery Shinjuku — 6 nights",
      details: { confirmation: "HG-44829", room: "Family superior" },
      amount: 1840,
      currency: "USD",
      payment_status: "paid" as const,
      cancellation_deadline: formatDateOnly(addDays(start, -3)) + "T23:59:00Z",
    },
    {
      type: "transport" as const,
      title: "JAL 005 — SFO ↔ HND",
      details: { confirmation: "JAL-7TR8XQ", seats: "23A/B/C/D" },
      amount: 4280,
      currency: "USD",
      payment_status: "paid" as const,
      cancellation_deadline: null,
    },
    {
      type: "other" as const,
      title: "Sushi Saito tasting menu (Day 3)",
      details: { party: 4, time: "19:30" },
      amount: 480,
      currency: "USD",
      payment_status: "pending" as const,
      cancellation_deadline: formatDateOnly(addDays(today, 3)) + "T18:00:00Z",
    },
  ]

  return {
    trip: {
      name: "Tokyo Family Trip",
      destination: "Tokyo, Japan",
      start_date: startStr,
      end_date: endStr,
      cover_image_url: TOKYO_COVER,
    },
    activities,
    bookings,
  }
}
