"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ChevronRight, GripVertical, Plus, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export type MenuRow = {
  id: string
  booking_id: string
  item_name: string
  qty: number
  unit_price: number
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function QtyInput({
  value,
  onChange,
  onBlur,
}: {
  value: number
  onChange: (v: number) => void
  onBlur: () => void
}) {
  const [local, setLocal] = useState(String(value))

  // Keep in sync if parent resets (e.g. on load)
  useEffect(() => { setLocal(String(value)) }, [value])

  return (
    <input
      type="number"
      min={1}
      value={local}
      onChange={e => {
        setLocal(e.target.value)
        const n = Number(e.target.value)
        if (!isNaN(n) && n >= 1) onChange(n)
      }}
      onBlur={() => {
        const n = Math.max(1, Number(local) || 1)
        setLocal(String(n))
        onChange(n)
        onBlur()
      }}
      className="w-full bg-transparent text-center text-[13px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      style={{ color: "#2C4A45", minHeight: 36 }}
    />
  )
}

function newRow(bookingId: string): MenuRow {
  return { id: crypto.randomUUID(), booking_id: bookingId, item_name: "", qty: 1, unit_price: 0 }
}

export function BookingMenuSection({
  bookingId,
  partySize,
}: {
  bookingId: string
  partySize: number
}) {
  const supabase = createClient()
  const [rows, setRows] = useState<MenuRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [perPersonOpen, setPerPersonOpen] = useState(false)
  // track which ids exist in DB already
  const dbIds = useRef<Set<string>>(new Set())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // drag state
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return
    setLoading(true)
    supabase
      .from("booking_menu_items")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const loaded = (data ?? []) as MenuRow[]
        setRows(loaded)
        dbIds.current = new Set(loaded.map(r => r.id))
        setLoading(false)
      })
  }, [bookingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save logic (debounced on blur) ───────────────────────────────────────
  const triggerSave = useCallback(
    (current: MenuRow[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const toSave = current.filter(r => r.item_name.trim() !== "" || r.unit_price > 0)
        if (toSave.length === 0) return

        const upserts = toSave.map(r => ({
          id: r.id,
          booking_id: r.booking_id,
          item_name: r.item_name,
          qty: r.qty,
          unit_price: r.unit_price,
        }))

        const { error } = await supabase
          .from("booking_menu_items")
          .upsert(upserts, { onConflict: "id" })

        if (!error) {
          toSave.forEach(r => dbIds.current.add(r.id))
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        }
      }, 800)
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Row mutation helpers ─────────────────────────────────────────────────
  function updateRow(id: string, patch: Partial<MenuRow>) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows(prev => [...prev, newRow(bookingId)])
  }

  async function deleteRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    if (dbIds.current.has(id)) {
      dbIds.current.delete(id)
      await supabase.from("booking_menu_items").delete().eq("id", id)
    }
  }

  function handleBlur(current: MenuRow[]) {
    triggerSave(current)
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const tableTotal = rows.reduce((s, r) => s + r.qty * r.unit_price, 0)
  const perPerson = partySize > 0 ? tableTotal / partySize : 0

  // ── Empty state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#A9D6C5] border-t-transparent" />
      </div>
    )
  }

  const isEmpty = rows.length === 0

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "#A9D6C5" }}
          >
            Pre-order Menu
          </span>
          {saved && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "#6D8F87" }}>
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[#EDF5F2]"
          style={{ color: "#6D8F87" }}
        >
          <Plus className="h-3 w-3" />
          Add item
        </button>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-6"
          style={{ border: "1.5px dashed #D4C9BC", minHeight: 72 }}
        >
          <p className="text-xs" style={{ color: "#9BA8A6" }}>No menu items yet</p>
          <button
            type="button"
            onClick={addRow}
            className="text-xs font-medium"
            style={{ color: "#6D8F87" }}
          >
            + Add your first item
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-xl" style={{ border: "0.5px solid #D4C9BC" }}>
            {/* Header row */}
            <div
              className="grid text-[10px] font-semibold uppercase tracking-wide"
              style={{
                gridTemplateColumns: "20px 1fr 48px 80px 72px 28px",
                color: "#A9D6C5",
                borderBottom: "0.5px solid #D4C9BC",
                padding: "5px 8px 5px 4px",
                background: "#FDFAF6",
              }}
            >
              <span />
              <span>Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {/* Data rows */}
            {rows.map((row, idx) => {
              const subtotal = row.qty * row.unit_price
              const isDragTarget = dragOver === idx && dragIdx.current !== idx
              return (
                <div
                  key={row.id}
                  draggable
                  onDragStart={() => { dragIdx.current = idx }}
                  onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => {
                    const from = dragIdx.current
                    if (from === null || from === idx) { setDragOver(null); return }
                    setRows(prev => {
                      const next = [...prev]
                      const [moved] = next.splice(from, 1)
                      next.splice(idx, 0, moved)
                      return next
                    })
                    dragIdx.current = null
                    setDragOver(null)
                  }}
                  onDragEnd={() => { dragIdx.current = null; setDragOver(null) }}
                  className="group grid items-center"
                  style={{
                    gridTemplateColumns: "20px 1fr 48px 80px 72px 28px",
                    borderBottom: idx < rows.length - 1 ? "0.5px solid #EDE8E0" : "none",
                    borderTop: isDragTarget ? "2px solid #A9D6C5" : undefined,
                    minHeight: 36,
                    padding: "0 8px 0 4px",
                    background: isDragTarget ? "#EDF5F2" : "#FFFBF4",
                    cursor: "grab",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Drag handle */}
                  <GripVertical
                    className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{ color: "#9BA8A6" }}
                  />

                  {/* Item name */}
                  <input
                    type="text"
                    value={row.item_name}
                    placeholder="Menu item"
                    onChange={e => updateRow(row.id, { item_name: e.target.value })}
                    onBlur={() => handleBlur(rows)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && idx === rows.length - 1) {
                        e.preventDefault()
                        addRow()
                      }
                    }}
                    className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#D4C9BC]"
                    style={{ color: "#2C4A45", minHeight: 36, cursor: "text" }}
                  />

                  {/* Qty */}
                  <QtyInput
                    value={row.qty}
                    onChange={v => updateRow(row.id, { qty: v })}
                    onBlur={() => handleBlur(rows)}
                  />

                  {/* Unit price */}
                  <div className="flex items-center justify-end gap-0.5">
                    <span className="text-[10px]" style={{ color: "#A9D6C5" }}>THB</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={row.unit_price || ""}
                      placeholder="0"
                      onChange={e => updateRow(row.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                      onBlur={() => handleBlur(rows)}
                      className="w-[44px] bg-transparent text-right text-[13px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-[#D4C9BC]"
                      style={{ color: "#2C4A45", minHeight: 36 }}
                    />
                  </div>

                  {/* Subtotal */}
                  <span
                    className="text-right text-[13px] font-medium tabular-nums"
                    style={{ color: "#6D8F87" }}
                  >
                    {subtotal > 0 ? fmt(subtotal) : "—"}
                  </span>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "#9BA8A6" }}
                    aria-label="Remove row"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Per-person breakdown */}
          {partySize > 1 && (
            <div
              className="overflow-hidden rounded-xl"
              style={{ background: "#F7F3EE", border: "0.5px solid #E8E0D8" }}
            >
              <button
                type="button"
                onClick={() => setPerPersonOpen(o => !o)}
                className="flex w-full items-center justify-between px-3 py-2"
              >
                <span className="text-[11px]" style={{ color: "#9BA8A6" }}>
                  Per person ({partySize} pax)
                </span>
                {perPersonOpen
                  ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "#9BA8A6" }} />
                  : <ChevronRight className="h-3.5 w-3.5" style={{ color: "#9BA8A6" }} />}
              </button>
              {perPersonOpen && (
                <div style={{ borderTop: "0.5px solid #E8E0D8" }}>
                  {rows
                    .filter(r => r.item_name.trim() || r.unit_price > 0)
                    .map(r => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-3 py-1.5"
                        style={{ borderBottom: "0.5px solid #EDE8E0" }}
                      >
                        <span className="text-[12px]" style={{ color: "#6D8F87" }}>
                          {r.item_name || "—"}
                        </span>
                        <span className="text-[12px] tabular-nums" style={{ color: "#2C4A45" }}>
                          THB {fmt(r.unit_price)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Total card */}
          <div
            className="rounded-xl px-3 py-2.5 space-y-1"
            style={{ background: "#EDF5F2", border: "0.5px solid #A9D6C5" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: "#6D8F87" }}>
                Table total{partySize > 1 ? ` (${partySize} pax)` : ""}
              </span>
              <span className="text-[15px] font-medium tabular-nums" style={{ color: "#2C4A45" }}>
                THB {fmt(tableTotal)}
              </span>
            </div>
            {partySize > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: "#6D8F87" }}>Per person</span>
                <span className="text-[13px] tabular-nums" style={{ color: "#2C4A45" }}>
                  THB {fmt(perPerson)}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
