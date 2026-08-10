import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { LoginView } from "@/views/auth/LoginView";
import { GuestGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";

// /login — customer/admin login. Wrapped in GuestGate so logged-in users
// are redirected to home.
export const metadata: Metadata = buildMetadata({
  title: "Masuk",
  description: "Masuk ke akun Anima Companion Anda.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <SiteShell>
      <GuestGate>
        <LoginView />
      </GuestGate>
    </SiteShell>
  );
}
