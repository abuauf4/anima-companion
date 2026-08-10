import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ProfileView } from "@/views/ProfileView";
import { AuthGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";

// /profile — customer profile. Requires auth.
export const metadata: Metadata = buildMetadata({
  title: "Profil Saya",
  description: "Akun Anima Companion Anda.",
  path: "/profile",
  noIndex: true,
});

export default function ProfilePage() {
  return (
    <SiteShell>
      <AuthGate>
        <ProfileView />
      </AuthGate>
    </SiteShell>
  );
}
