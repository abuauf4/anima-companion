import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ResetPasswordView } from "@/views/auth/ResetPasswordView";
import { buildMetadata } from "@/lib/seo";

// /reset-password — V2 password reset page.
// User enters their email + the 6-digit PASSWORD_RESET OTP they received.
// On verification, the server issues a short-lived single-use reset grant
// which the user submits with their new password.
//
// Stage 6: OTP verification + grant issuance.
// Stage 7: actual password reset (bcrypt + sessionVersion bump).
export const metadata: Metadata = buildMetadata({
  title: "Reset Password",
  description: "Reset password akun Anima Companion Anda.",
  path: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return (
    <SiteShell auth>
      <ResetPasswordView />
    </SiteShell>
  );
}
