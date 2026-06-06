"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import {
  uploadBookingAttachment,
  deleteBookingAttachment,
  formatFileSize,
  isImageFile,
  isPdfFile,
  type BookingAttachment,
} from "@/lib/supabase/booking-attachments"
import { toast } from "sonner"
import { Upload, X, File, FileText, ImageIcon, Loader2, ExternalLink, Paperclip } from "lucide-react"

interface BookingAttachmentsProps {
  bookingId: string
  tripId: string
  initialAttachments?: BookingAttachment[]
}

export function BookingAttachments({
  bookingId,
  tripId,
  initialAttachments = [],
}: BookingAttachmentsProps) {
  const [attachments, setAttachments] = useState<BookingAttachment[]>(initialAttachments)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (!files.length) return
      setUploading(true)
      const fileArray = Array.from(files)
      const newAttachments: BookingAttachment[] = []
      const errors: string[] = []

      for (const file of fileArray) {
        try {
          const attachment = await uploadBookingAttachment(bookingId, tripId, file)
          newAttachments.push(attachment)
        } catch {
          errors.push(file.name)
        }
      }

      setAttachments((prev) => [...prev, ...newAttachments])
      setUploading(false)

      if (newAttachments.length > 0)
        toast.success(`${newAttachments.length} file${newAttachments.length > 1 ? "s" : ""} uploaded`)
      if (errors.length > 0)
        toast.error(`Failed to upload: ${errors.join(", ")}`)
    },
    [bookingId, tripId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect],
  )

  const handleDelete = async (attachment: BookingAttachment) => {
    try {
      await deleteBookingAttachment(attachment.id, attachment.storage_path)
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
      toast.success("File removed")
    } catch {
      toast.error("Failed to remove file")
    }
  }

  function FileIcon({ fileType }: { fileType: string }) {
    if (isImageFile(fileType)) return <ImageIcon className="h-4 w-4 text-muted-foreground" />
    if (isPdfFile(fileType)) return <FileText className="h-4 w-4 text-red-500" />
    return <File className="h-4 w-4 text-blue-500" />
  }

  return (
    <div className="space-y-3">
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="group relative">
              {isImageFile(attachment.file_type) ? (
                <button
                  type="button"
                  title="Open image"
                  onClick={() => window.open(attachment.public_url, "_blank", "noopener,noreferrer")}
                  className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80"
                >
                  <Image
                    src={attachment.public_url}
                    alt={attachment.file_name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-4 w-4 text-white" />
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  title={isPdfFile(attachment.file_type) ? "Open PDF" : "Open file"}
                  onClick={() => window.open(attachment.public_url, "_blank", "noopener,noreferrer")}
                  className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-border bg-secondary p-1 transition-colors hover:bg-secondary/70"
                >
                  <FileIcon fileType={attachment.file_type} />
                  <span className="w-full truncate px-1 text-center text-[9px] text-muted-foreground">
                    {attachment.file_name.split(".").pop()?.toUpperCase()}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDelete(attachment)}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>

              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 group-hover:block">
                <div className="max-w-[150px] truncate rounded bg-gray-900 px-2 py-1 text-[10px] text-white">
                  {attachment.file_name}
                  <br />
                  <span className="text-gray-400">{formatFileSize(attachment.file_size)}</span>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Add</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Paperclip className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Attach files</p>
              <p className="text-xs text-muted-foreground">Drag & drop or click · Any file type</p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
      />
    </div>
  )
}

interface PendingAttachmentsProps {
  files: File[]
  onChange: (files: File[]) => void
}

export function PendingAttachments({ files, onChange }: PendingAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming?.length) return
    onChange([...files, ...Array.from(incoming)])
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className="group relative">
              <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-secondary p-1">
                {isImageFile(file.type) ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : isPdfFile(file.type) ? (
                  <FileText className="h-4 w-4 text-red-500" />
                ) : (
                  <File className="h-4 w-4 text-blue-500" />
                )}
                <span className="w-full truncate px-1 text-center text-[9px] text-muted-foreground">
                  {file.name.split(".").pop()?.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Add</span>
          </button>
        </div>
      ) : (
        <div
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div className="flex flex-col items-center gap-2">
            <Paperclip className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Attach files</p>
            <p className="text-xs text-muted-foreground">Drag & drop or click · Uploads on save</p>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  )
}
