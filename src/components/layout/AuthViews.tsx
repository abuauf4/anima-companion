'use client'

/**
 * AuthViews — shared loading/access-denied screens.
 *
 * Extracted from the original HashRouter.tsx so they can be reused by
 * AuthGate / AdminGate / GuestGate without duplicating markup.
 */

export function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">Memuat...</p>
      </div>
    </div>
  )
}

export function UnauthorizedView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🔒</div>
      <h1 className="mb-2 text-2xl font-bold">Akses Ditolak</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Halaman ini khusus untuk admin. Silakan masuk dengan akun admin untuk melanjutkan.
      </p>
      <a
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Masuk sebagai Admin
      </a>
    </div>
  )
}

export function LoginRequiredView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🐾</div>
      <h1 className="mb-2 text-2xl font-bold">Silakan Masuk</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Anda perlu masuk terlebih dahulu untuk mengakses halaman ini.
      </p>
      <div className="flex gap-3">
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Masuk
        </a>
        <a
          href="/register"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Daftar
        </a>
      </div>
    </div>
  )
}

export function NotFoundView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🐱</div>
      <h1 className="mb-2 text-2xl font-bold">Halaman Tidak Ditemukan</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Sepertinya halaman yang Anda cari sudah tidak tersedia.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Kembali ke Beranda
      </a>
    </div>
  )
}
