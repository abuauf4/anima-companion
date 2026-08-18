import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { RegisterView } from "@/views/auth/RegisterView";
import { GuestGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";

// /register — new customer signup.
export const metadata: Metadata = buildMetadata({
  title: "Daftar",
  description: "Daftar akun Anima Companion baru.",
  path: "/register",
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <SiteShell auth>
      <GuestGate>
        <RegisterView />
      </GuestGate>
    </SiteShell>
  );
}
