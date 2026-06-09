"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { Sparkles, Send, X, Plus, Check, MessageCircle, MapPin, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { addAIActivities } from "@/app/actions/add-ai-activities"
import { toast } from "sonner"
import { daysBetween } from "@/lib/dates"
import type { Activity, Trip } from "@/lib/types"

type Suggestion = {
  title: string
  category: Activity["category"]
  location: string | null
  time_block: "morning" | "afternoon" | "night"
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_amount: number | null
  day_date: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  suggestions?: Suggestion[]
  summary?: string
  streaming?: boolean
}

const CATEGORY_COLORS: Record<Activity["category"], string> = {
  dining:        "bg-orange-100 text-orange-700",
  experiences:   "bg-blue-100 text-blue-700",
  transport:     "bg-slate-100 text-slate-700",
  accommodation: "bg-purple-100 text-purple-700",
  other:         "bg-secondary text-muted-foreground",
}

const STARTERS = [
  "Suggest activities for my whole trip",
  "What should I do on the first day?",
  "Find restaurants near my hotel",
  "What's the best way to get around?",
]

function detectMode(message: string): "chat" | "suggest" {
  const lowerMsg = message.toLowerCase()

  const chatPatterns = [
    /^how (long|much|many|do|can|should|far|is|are|was)/,
    /^what (is|are|time|should|do)/,
    /^where (is|are|can|should)/,
    /^when (is|are|should|do)/,
    /^why /,
    /^is (it|there|this)/,
    /\?$/,
    /how long/,
    /how much/,
    /what time/,
    /opening hour/,
    /how to get/,
    /distance/,
    /worth visiting/,
    /tips for/,
    /best time/,
    /weather/,
    /visa/,
    /currency/,
    /tell me about/,
    /what about/,
  ]

  const suggestPatterns = [
    /^suggest/,
    /^find me/,
    /^show me/,
    /^give me/,
    /^add .* to/,
    /^plan .* for/,
    /places to (eat|go|see|stay)/,
    /activities for day/,
    /what (to do|to eat|to see|to visit)/,
    /suggest .* for day/,
    /recommend .* (restaurant|hotel|activity|place)/,
  ]

  for (const pattern of chatPatterns) {
    if (pattern.test(lowerMsg)) return "chat"
  }

  for (const pattern of suggestPatterns) {
    if (pattern.test(lowerMsg)) return "suggest"
  }

  return "chat"
}

function formatTime(t: string | null) {
  return t ? t.slice(0, 5) : null
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function SuggestionCard({
  suggestion,
  selected,
  onToggle,
}: {
  suggestion: Suggestion
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium leading-tight">{suggestion.title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", CATEGORY_COLORS[suggestion.category])}>
              {suggestion.category}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">{formatDate(suggestion.day_date)}</span>
            <span className="capitalize">{suggestion.time_block}</span>
            {(suggestion.start_time || suggestion.end_time) && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(suggestion.start_time)}
                {suggestion.end_time ? ` – ${formatTime(suggestion.end_time)}` : ""}
              </span>
            )}
            {suggestion.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{suggestion.location}</span>
              </span>
            )}
          </div>
          {suggestion.notes && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{suggestion.notes}</p>
          )}
        </div>
        <div
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {selected && <Check className="h-3 w-3" />}
        </div>
      </div>
    </button>
  )
}

export function TriplettoAI({
  trip,
  activities,
  onActivitiesAdded,
}: {
  trip: Trip
  activities: Activity[]
  onActivitiesAdded: (added: Activity[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [slowLoading, setSlowLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isEmpty = activities.length === 0

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!loading) { setSlowLoading(false); return }
    const t = setTimeout(() => setSlowLoading(true), 3000)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send(text: string, modeOverride?: "chat" | "suggest") {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput("")

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed }
    setMessages((p) => [...p, userMsg])
    setLoading(true)
    setSelected(new Set())

    const mode = modeOverride ?? detectMode(trimmed)

    const days = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) : []
    const dayContext = days.map((dateStr, i) => ({
      day: i + 1,
      date: dateStr,
      dateLabel: new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      }),
      activities: activities
        .filter((a) => a.day_date === dateStr)
        .map((a) => ({
          title: a.title,
          location: a.location,
          time: a.start_time,
          category: a.category,
        })),
    }))

    console.log("TriplettoAI activities received:", activities?.length, "sample:", JSON.stringify(activities?.[0]))
    console.log("dayContext built:", JSON.stringify(dayContext.slice(0, 2)))

    try {
      if (mode === "suggest") {
        const res = await fetch("/api/tripletto-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "suggest", trip, activities, message: trimmed, dayContext }),
        })
        const data = await res.json()
        if (data.type === "suggestions") {
          const suggestions = data.suggestions as Suggestion[]
          setMessages((p) => [
            ...p,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: data.summary ?? "Here are some activity ideas:",
              suggestions,
            },
          ])
          setSelected(new Set(suggestions.map((_, i) => i)))
        } else {
          setMessages((p) => [...p, { id: Date.now().toString(), role: "assistant", content: data.content }])
        }
      } else {
        const assistantId = (Date.now() + 1).toString()
        setMessages((p) => [...p, { id: assistantId, role: "assistant", content: "", streaming: true }])

        const res = await fetch("/api/tripletto-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat", trip, activities, message: trimmed, dayContext }),
        })

        if (!res.ok || !res.body) {
          let errMsg = "Couldn't reach Tripletto AI. Try again."
          try {
            const errData = await res.clone().json()
            if (errData?.error) errMsg = errData.error
          } catch { /* ignore */ }
          setMessages((p) =>
            p.map((m) =>
              m.id === assistantId
                ? { ...m, content: errMsg, streaming: false }
                : m,
            ),
          )
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setMessages((p) =>
            p.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
          )
        }

        setMessages((p) =>
          p.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
        )
      }
    } catch {
      toast.error("Couldn't reach Tripletto AI. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const lastSuggestions = [...messages].reverse().find((m) => m.suggestions)?.suggestions

  async function confirmSelected() {
    if (!lastSuggestions || selected.size === 0) return
    setAdding(true)
    try {
      const toAdd = [...selected].map((i) => lastSuggestions[i])
      const added = await addAIActivities(trip.id, trip.default_currency ?? "USD", toAdd)
      onActivitiesAdded(added)
      toast.success(`Added ${added.length} activit${added.length === 1 ? "y" : "ies"}`)
      setSelected(new Set())
    } catch {
      toast.error("Failed to add activities")
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      {/* Welcome banner — shown when no activities */}
      {isEmpty && (
        <div className="mb-2 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">Let Tripletto AI plan your trip</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                No activities yet — ask AI to suggest what to do in {trip.destination ?? "your destination"}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setOpen(true); setInput(s) }}
                    className="rounded-full border border-primary/30 bg-background px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating button — shown when activities exist */}
      {!isEmpty && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      )}

      {/* AI Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Tripletto AI
            </SheetTitle>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ask me anything about your trip to{" "}
                  <span className="font-medium text-foreground">{trip.destination ?? trip.name}</span>.
                </p>
                <div className="flex flex-col gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s, s === "Suggest activities for my whole trip" ? "suggest" : undefined)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex flex-col gap-2", msg.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="mt-1 mb-2 last:mb-0 space-y-0.5 pl-4 list-disc">{children}</ul>,
                          li: ({ children }) => <li className="leading-snug">{children}</li>,
                          h1: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                          h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                          h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.streaming && (
                        <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 align-middle animate-pulse" />
                      )}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="w-full space-y-2">
                    {msg.suggestions.map((s, si) => (
                      <SuggestionCard
                        key={si}
                        suggestion={s}
                        selected={selected.has(si) && msg === [...messages].reverse().find((m) => m.suggestions)}
                        onToggle={() => {
                          if (msg !== [...messages].reverse().find((m) => m.suggestions)) return
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(si)) next.delete(si)
                            else next.add(si)
                            return next
                          })
                        }}
                      />
                    ))}

                    {msg === [...messages].reverse().find((m) => m.suggestions) && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl"
                          disabled={selected.size === 0 || adding}
                          onClick={confirmSelected}
                        >
                          {adding ? (
                            "Adding…"
                          ) : (
                            <>
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Add {selected.size} activit{selected.size === 1 ? "y" : "ies"}
                            </>
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setSelected(new Set(msg.suggestions!.map((_, i) => i)))}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected(new Set())}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          None
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && !messages.some((m) => m.streaming) && (
              <div className="flex flex-col items-start gap-1">
                <div className="rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                  </span>
                </div>
                {slowLoading && (
                  <p className="pl-1 text-[11px] text-muted-foreground/60">This may take a few seconds…</p>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Ask about activities, nearby places, logistics…"
                rows={1}
                className="min-h-[40px] max-h-32 flex-1 resize-none rounded-xl text-sm"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                disabled={!input.trim() || loading}
                onClick={() => send(input)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
