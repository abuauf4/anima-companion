import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ForgotPasswordView } from "@/views/auth/ForgotPasswordView";
import { buildMetadata } from "@/lib/seo";

// /forgot-password — V2 password reset initiation page.
// User enters their email → /api/auth/forgot-password issues a PASSWORD_RESET
// OTP (if the email exists + is a PASSWORD account) and emails it. The
// response is always { sent: true } (anti-enumeration).
//
// Stage 6 will add /reset-password where the user enters the OTP + new password.
export const metadata: Metadata = buildMetadata({
  title: "Lupa Password",
  description: "Reset password akun Anima Companion Anda.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <SiteShell auth>
      <ForgotPasswordView />
    </SiteShell>
  );
}
