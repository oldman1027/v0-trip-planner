"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Heart, Plus, Trash2 } from "lucide-react"
import type { Activity } from "@/lib/types"

type WishlistSidebarProps = {
  wishlistActivities: Activity[]
  onAddToDay?: (activity: Activity) => void
  onDelete?: (id: string) => void
}

export function WishlistSidebar({ wishlistActivities, onAddToDay, onDelete }: WishlistSidebarProps) {
  const [filter, setFilter] = useState("")
  const [newActivityTitle, setNewActivityTitle] = useState("")

  const grouped = wishlistActivities.reduce(
    (acc, a) => {
      const cat = a.category || "other"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(a)
      return acc
    },
    {} as Record<string, Activity[]>
  )

  const filtered = Object.fromEntries(
    Object.entries(grouped).map(([cat, acts]) => [
      cat,
      acts.filter((a) => a.title.toLowerCase().includes(filter.toLowerCase())),
    ])
  )

  const handleAddWishlist = async () => {
    if (!newActivityTitle.trim()) return
    // TODO: Create wishlist activity
    setNewActivityTitle("")
  }

  return (
    <Tabs defaultValue="wishlist" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
        <TabsTrigger value="ideas">Ideas</TabsTrigger>
      </TabsList>

      <TabsContent value="wishlist" className="flex-1 space-y-3 overflow-y-auto pb-4">
        <div className="space-y-2 px-1">
          <Input
            placeholder="Search activities..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8"
          />
        </div>

        {Object.entries(filtered).map(([category, activities]) => {
          if (activities.length === 0) return null
          return (
            <div key={category} className="space-y-2">
              <h4 className="px-1 text-xs font-semibold uppercase text-muted-foreground">{category}</h4>
              {activities.map((a) => (
                <Card key={a.id} className="p-2 text-sm hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 truncate">
                      <p className="truncate font-medium">{a.title}</p>
                      {a.location ? <p className="text-xs text-muted-foreground">{a.location}</p> : null}
                    </div>
                    <div className="flex gap-1">
                      {onAddToDay ? (
                        <Button size="sm" variant="ghost" onClick={() => onAddToDay(a)}>
                          <Plus className="h-3 w-3" aria-hidden />
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(a.id)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        })}

        <Separator className="my-2" />

        <div className="space-y-2 px-1">
          <label className="text-xs font-semibold uppercase text-muted-foreground">New idea</label>
          <div className="flex gap-2">
            <Input
              placeholder="Activity idea..."
              value={newActivityTitle}
              onChange={(e) => setNewActivityTitle(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddWishlist()
              }}
            />
            <Button size="sm" onClick={handleAddWishlist} disabled={!newActivityTitle.trim()}>
              <Plus className="h-3 w-3" aria-hidden />
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="ideas" className="flex-1 space-y-2 overflow-y-auto pb-4 px-1">
        <p className="text-xs text-muted-foreground">Saved inspiration and quick links</p>
        <Card className="p-3 text-sm text-muted-foreground">Coming soon: bookmark external ideas</Card>
      </TabsContent>
    </Tabs>
  )
}
