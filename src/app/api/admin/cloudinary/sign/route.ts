import { NextResponse } from 'next/server'
import { requirePermission, requireAdminSessionActive, handleAuthError } from '@/lib/admin-auth'
import {
  buildSignatureResponse,
  getCloudinaryConfig,
  PRODUCT_UPLOAD_FOLDER,
} from '@/lib/cloudinary'

/**
 * GET /api/admin/cloudinary/sign
 *
 * Returns a short-lived Cloudinary signed-upload signature that the
 * admin browser uses to upload a single image directly to Cloudinary's
 * REST API. The browser performs the upload itself
 * (multipart/form-data → https://api.cloudinary.com/v1_1/<cloud>/auto/upload)
 * and then sends the resulting secure_url to the appropriate save API
 * (product create/update, or site settings PUT).
 *
 * Permission model:
 *   - Any authenticated admin with EITHER `products.manage` OR
 *     `settings.manage` may request a signature. The signature itself
 *     is the same regardless of which permission gated the request —
 *     it grants upload access to the `anima/products/` folder only.
 *   - This was relaxed from products.manage-only to also accept
 *     settings.manage so the Site Settings page (Admin > Pengaturan)
 *     can upload Hero Images without needing a separate sign endpoint.
 *
 * Security:
 *   - requireAdminSessionActive() enforces server-side admin role.
 *   - CLOUDINARY_API_SECRET is NEVER returned to the browser. Only the
 *     derived signature (valid only for the params it was computed over),
 *     the public api_key, cloud name, and folder are returned.
 *   - The signature is single-use in practice because it includes the
 *     timestamp; Cloudinary rejects signatures older than 1 hour.
 *
 * Response 200:
 *   { signature, timestamp, apiKey, cloudName, folder }
 *
 * Response 503 (Cloudinary not configured on the server):
 *   { error: 'CLOUDINARY_NOT_CONFIGURED' }
 *   The admin UI should show a "Cloudinary belum dikonfigurasi" message
 *   and disable the upload button, but allow manual URL paste as a fallback.
 */
export async function GET() {
  try {
    // Auth check — must be an authenticated, non-must-change-password admin.
    // Then check that the admin has at least one of the upload-granting
    // permissions. We use requirePermission('products.manage') first
    // (the historical guard), and if that throws FORBIDDEN, fall through
    // to requirePermission('settings.manage'). If both throw, the error
    // propagates up and gets converted to a 403 by handleAuthError.
    const admin = await requireAdminSessionActive()
    const hasProductsManage = admin.permissions.includes('products.manage')
    const hasSettingsManage = admin.permissions.includes('settings.manage')
    if (admin.systemRole !== 'DEVELOPER' && !hasProductsManage && !hasSettingsManage) {
      // Throw FORBIDDEN via the standard path so handleAuthError can map it.
      try { await requirePermission('products.manage') } catch (e) { /* fall through to handleAuthError below */ throw e }
    }
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    throw e
  }

  const config = getCloudinaryConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'CLOUDINARY_NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  const payload = buildSignatureResponse(config, PRODUCT_UPLOAD_FOLDER)
  return NextResponse.json(payload)
}
