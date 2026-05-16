import { createClient } from "@/lib/supabase/client"

export interface BookingAttachment {
  id: string
  booking_id: string
  trip_id: string
  user_id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  public_url: string
  created_at: string
}

export async function uploadBookingAttachment(
  bookingId: string,
  tripId: string,
  file: File,
): Promise<BookingAttachment> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const fileExt = file.name.split(".").pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
  const storagePath = `${user.id}/${tripId}/${bookingId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("booking-attachments")
    .upload(storagePath, file)

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from("booking-attachments")
    .getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from("booking_attachments")
    .insert({
      booking_id: bookingId,
      trip_id: tripId,
      user_id: user.id,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      storage_path: storagePath,
      public_url: publicUrl,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBookingAttachment(
  attachmentId: string,
  storagePath: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.storage.from("booking-attachments").remove([storagePath])
  const { error } = await supabase
    .from("booking_attachments")
    .delete()
    .eq("id", attachmentId)
  if (error) throw error
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImageFile(fileType: string): boolean {
  return fileType.startsWith("image/")
}

export function isPdfFile(fileType: string): boolean {
  return fileType === "application/pdf"
}
