import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { ProblemDetailView } from "@/views/ProblemDetailView";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { db } from "@/lib/db";

// /problem/[slug] — problem detail page with related products.

interface Params {
  params: Promise<{ slug: string }>
}

async function fetchProblem(slug: string) {
  return db.problem.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
    },
  })
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const problem = await fetchProblem(slug)

  if (!problem) {
    return buildMetadata({
      title: "Kategori Tidak Ditemukan",
      description: "Kategori masalah kesehatan yang Anda cari tidak tersedia.",
      path: `/problem/${slug}`,
      noIndex: true,
    })
  }

  const description =
    problem.description?.slice(0, 160) ||
    `Temukan suplemen & vitamin hewan peliharaan untuk ${problem.name}.`

  return buildMetadata({
    title: `${problem.name} — Suplemen untuk ${problem.name}`,
    description,
    path: `/problem/${problem.slug}`,
    keywords: [problem.name, `suplemen ${problem.name.toLowerCase()}`, `vitamin ${problem.name.toLowerCase()}`],
  })
}

export default async function ProblemDetailPage({ params }: Params) {
  const { slug } = await params
  const problem = await fetchProblem(slug)

  if (!problem) {
    notFound()
  }

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Beranda", path: "/" },
    { name: "Shop by Problem", path: "/problem" },
    { name: problem.name, path: `/problem/${problem.slug}` },
  ])

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <ProblemDetailView slug={slug} />
    </SiteShell>
  )
}
