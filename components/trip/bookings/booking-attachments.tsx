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
import { Upload, X, File, FileText, ImageIcon, Loader2, Maximize2, Download, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const [viewerFile, setViewerFile] = useState<BookingAttachment | null>(null)
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
                <div
                  className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80"
                  onClick={() => setViewerFile(attachment)}
                >
                  <Image
                    src={attachment.public_url}
                    alt={attachment.file_name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4 text-white" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewerFile(attachment)}
                  className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-border bg-secondary p-1 transition-colors hover:bg-secondary/70"
                >
                  <FileIcon fileType={attachment.file_type} />
                  <span className="w-full truncate px-1 text-center text-[9px] text-muted-foreground">
                    {attachment.file_name.split(".").pop()?.toUpperCase()}
                  </span>
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

      {/* Full-screen viewer */}
      {viewerFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewerFile(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{viewerFile.file_name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(viewerFile.file_size)}</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={viewerFile.public_url}
                  download={viewerFile.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-white transition-colors hover:text-gray-300"
                >
                  <Download className="h-5 w-5" />
                </a>
                <button
                  type="button"
                  onClick={() => setViewerFile(null)}
                  className="text-white transition-colors hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {isImageFile(viewerFile.file_type) ? (
              <img
                src={viewerFile.public_url}
                alt={viewerFile.file_name}
                className="mx-auto max-h-[80vh] max-w-full rounded-lg object-contain"
              />
            ) : isPdfFile(viewerFile.file_type) ? (
              <iframe
                src={viewerFile.public_url}
                className="h-[80vh] w-full rounded-lg bg-white"
                title={viewerFile.file_name}
              />
            ) : (
              <div className="rounded-lg bg-white p-8 text-center">
                <File className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="mb-4 text-gray-600">{viewerFile.file_name}</p>
                <a
                  href={viewerFile.public_url}
                  download={viewerFile.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  Download file
                </a>
              </div>
            )}
          </div>
        </div>
      )}
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
