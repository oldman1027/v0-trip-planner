"use client"

import { useRef, useState } from "react"
import { MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function LocationAutocomplete({ id, value, onChange, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function getLibrary() {
    return google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>
  }

  async function fetchSuggestions(input: string) {
    if (!input.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await getLibrary()
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken()
      }
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
      })
      setSuggestions(results)
      setActiveIndex(-1)
      setOpen(results.length > 0)
    } catch {
      setSuggestions([])
      setOpen(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 300)
  }

  function select(suggestion: google.maps.places.AutocompleteSuggestion) {
    const pred = suggestion.placePrediction
    if (!pred) return
    onChange(pred.text.text)
    setSuggestions([])
    setOpen(false)
    sessionTokenRef.current = null
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      select(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={cn("rounded-xl", className)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {suggestions.map((s, i) => {
            const pred = s.placePrediction
            if (!pred) return null
            return (
              <li key={pred.placeId} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onMouseDown={() => select(s)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                    i === activeIndex && "bg-accent",
                  )}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{pred.mainText?.text}</div>
                    <div className="truncate text-xs text-muted-foreground">{pred.secondaryText?.text}</div>
                  </div>
                </button>
              </li>
            )
          })}
          <li className="flex items-center justify-end px-3 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
              alt="Powered by Google"
              className="h-4"
            />
          </li>
        </ul>
      )}
    </div>
  )
}
