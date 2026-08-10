import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { SiteShell } from "@/components/layout/SiteShell";

// /not-found (404) — Next.js App Router convention.
// Server component so it can render even when the user lands on a totally
// unknown path (no client-side JS required to show the 404).
export const metadata = buildMetadata({
  title: "Halaman Tidak Ditemukan",
  description: "Halaman yang Anda cari tidak tersedia.",
  noIndex: true,
});

export default function NotFound() {
  return (
    <SiteShell>
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 text-5xl">🐱</div>
        <h1 className="mb-2 text-2xl font-bold">Halaman Tidak Ditemukan</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          Sepertinya halaman yang Anda cari sudah tidak tersedia.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </SiteShell>
  );
}
