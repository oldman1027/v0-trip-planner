"use client"

import { useState, useRef } from "react"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  currentAvatarUrl?: string | null
  userId: string
}

export function EditProfileDialog({
  open,
  onOpenChange,
  currentName,
  currentAvatarUrl,
  userId,
}: EditProfileDialogProps) {
  const [name, setName] = useState(currentName)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(currentAvatarUrl ?? "")
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB")
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    const supabase = createClient()

    try {
      let newAvatarUrl = currentAvatarUrl ?? null

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()
        const path = `${userId}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from("avatars").getPublicUrl(path)
        // Bust cache so the new avatar loads immediately
        newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: name.trim(), avatar_url: newAvatarUrl },
      })
      if (authError) throw authError

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: userId, full_name: name.trim(), avatar_url: newAvatarUrl })
      if (profileError) throw profileError

      toast.success("Profile updated")
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error("Profile update error:", err)
      toast.error("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview} />
                <AvatarFallback className="bg-secondary text-lg text-secondary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-secondary transition-colors"
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Max 2MB · JPG, PNG, WEBP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSave()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? <><Spinner className="mr-2 size-4" /> Saving…</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
