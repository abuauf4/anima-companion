'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Loader2, UploadCloud, X, Star } from 'lucide-react'

/**
 * CloudinaryUploader — admin-only image upload UI.
 *
 * Workflow:
 *   1. Admin clicks "Upload Foto" or drops files into the dropzone.
 *   2. For each file:
 *      a. GET /api/admin/cloudinary/sign — gets a short-lived Cloudinary
 *         signature (admin-only, server signs with CLOUDINARY_API_SECRET
 *         which is never returned).
 *      b. POST the file as multipart/form-data directly to Cloudinary
 *         (https://api.cloudinary.com/v1_1/<cloud>/auto/upload). The browser
 *         uploads the bytes — the bytes never touch our server.
 *      c. On success Cloudinary returns { secure_url, public_id, ... }.
 *      d. We hand the secure_url back to the parent via onUploaded().
 *
 * The parent (ProductDialog) stores these URLs in the existing
 * ProductImage.url field — same data model, no DB migration needed.
 *
 * Security notes:
 *   - The signature endpoint requires an authenticated ADMIN session
 *     (requireAdmin() on the server).
 *   - CLOUDINARY_API_SECRET is server-only and never bundled.
 *   - Only the public cloud name + api key + derived signature go to
 *     the browser.
 *
 * Folder: anima/products/ (Cloudinary auto-generates the public_id).
 */

interface CloudinaryUploaderProps {
  /** Called once per successfully uploaded file with the secure URL. */
  onUploaded: (url: string) => void
  /** Disable the upload button (e.g. while product form is saving). */
  disabled?: boolean
  /** Compact variant used inside dense forms. */
  compact?: boolean
}

interface UploadJob {
  id: string
  fileName: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  errorMessage?: string
  resultUrl?: string
}

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8 MB per file

export function CloudinaryUploader({ onUploaded, disabled, compact }: CloudinaryUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [cloudNotConfigured, setCloudNotConfigured] = useState(false)

  const fetchSignature = useCallback(async () => {
    const res = await fetch('/api/admin/cloudinary/sign', { method: 'GET' })
    if (res.status === 503) {
      setCloudNotConfigured(true)
      throw new Error('CLOUDINARY_NOT_CONFIGURED')
    }
    if (!res.ok) {
      throw new Error('Gagal mendapatkan signature upload')
    }
    return await res.json() as {
      signature: string
      timestamp: number
      apiKey: string
      cloudName: string
      folder: string
    }
  }, [])

  const uploadOne = useCallback(
    async (file: File) => {
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setJobs((prev) => [
        ...prev,
        { id: jobId, fileName: file.name, progress: 0, status: 'uploading' },
      ])
      try {
        const sig = await fetchSignature()
        const formData = new FormData()
        formData.append('file', file)
        formData.append('api_key', sig.apiKey)
        formData.append('timestamp', String(sig.timestamp))
        formData.append('signature', sig.signature)
        formData.append('folder', sig.folder)

        const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`

        const xhr = new XMLHttpRequest()
        const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
          xhr.open('POST', uploadUrl, true)
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setJobs((prev) =>
                prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j)),
              )
            }
          }
          xhr.onload = () => {
            try {
              const body = JSON.parse(xhr.responseText)
              if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
                resolve({ secure_url: body.secure_url })
              } else {
                reject(new Error(body?.error?.message || `Upload gagal (${xhr.status})`))
              }
            } catch (e) {
              reject(new Error('Respon Cloudinary tidak valid'))
            }
          }
          xhr.onerror = () => reject(new Error('Koneksi ke Cloudinary gagal'))
          xhr.onabort = () => reject(new Error('Upload dibatalkan'))
          xhr.send(formData)
        })

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, progress: 100, status: 'done', resultUrl: result.secure_url }
              : j,
          ),
        )
        onUploaded(result.secure_url)
      } catch (e: any) {
        const msg = e.message === 'CLOUDINARY_NOT_CONFIGURED'
          ? 'Cloudinary belum dikonfigurasi di server'
          : (e?.message || 'Upload gagal')
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: 'error', errorMessage: msg }
              : j,
          ),
        )
        toast.error(msg)
      }
    },
    [fetchSignature, onUploaded],
  )

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (arr.length === 0) return
      for (const f of arr) {
        if (!ACCEPTED_MIME.includes(f.type)) {
          toast.error(`Format file tidak didukung: ${f.name}`)
          continue
        }
        if (f.size > MAX_FILE_SIZE) {
          toast.error(`Ukuran ${f.name} melebihi 8 MB`)
          continue
        }
        void uploadOne(f)
      }
    },
    [uploadOne],
  )

  const clearDone = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'uploading'))
  }, [])

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  // Drag-and-drop handler — used by the dropzone, not by click-upload.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled) return
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(',')}
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files)
          // Reset so the same file can be re-selected after a failed upload.
          e.target.value = ''
        }}
        disabled={disabled || cloudNotConfigured}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 ${compact ? 'py-4' : 'py-6'} text-center`}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Tarik & lepas gambar di sini, atau
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || cloudNotConfigured}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="size-4" /> Upload Foto
        </Button>
        <p className="text-[10px] text-muted-foreground">
          JPG, PNG, WebP, GIF, AVIF, HEIC · Maks 8 MB
        </p>
      </div>

      {cloudNotConfigured && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Cloudinary belum dikonfigurasi di server. Set
          CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET
          di environment Coolify untuk mengaktifkan upload.
        </p>
      )}

      {jobs.length > 0 && (
        <ul className="space-y-1.5">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-xs"
            >
              {job.status === 'uploading' && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              )}
              {job.status === 'done' && (
                <Star className="h-3.5 w-3.5 shrink-0 fill-current text-emerald-500" />
              )}
              {job.status === 'error' && (
                <X className="h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-mono text-[11px]">{job.fileName}</p>
                {job.status === 'uploading' && (
                  <Progress value={job.progress} className="mt-1 h-1" />
                )}
                {job.status === 'error' && (
                  <p className="mt-0.5 text-[11px] text-destructive">{job.errorMessage}</p>
                )}
                {job.status === 'done' && job.resultUrl && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    Uploaded
                  </p>
                )}
              </div>
              {(job.status === 'done' || job.status === 'error') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeJob(job.id)}
                  aria-label="Hapus dari daftar upload"
                >
                  <X className="size-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
