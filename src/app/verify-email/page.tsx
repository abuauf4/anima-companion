import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { VerifyEmailView } from "@/views/auth/VerifyEmailView";
import { buildMetadata } from "@/lib/seo";

// /verify-email — landing page for email verification links.
// The token is read from `?token=...` and submitted to
// /api/auth/verify-email/confirm. The page works whether the user is
// logged in or not — verification state lives in the DB, not the session.
export const metadata: Metadata = buildMetadata({
  title: "Verifikasi Email",
  description: "Verifikasi email Anima Companion Anda.",
  path: "/verify-email",
  noIndex: true,
});

export default function VerifyEmailPage() {
  return (
    <SiteShell>
      <VerifyEmailView />
    </SiteShell>
  );
}
