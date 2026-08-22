import { NextResponse } from 'next/server'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
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
 *   - Accepts EITHER `products.manage` OR `settings.manage`. This lets
 *     both the Products page and the Settings page use the SAME uploader
 *     component (CloudinaryUploader) without a separate sign endpoint.
 *   - The check is simple: try `products.manage` first. If that throws
 *     FORBIDDEN, try `settings.manage`. If both throw, the FORBIDDEN error
 *     propagates and gets converted to a 403 response by handleAuthError.
 *
 * Security:
 *   - requirePermission() enforces server-side admin role + permission check.
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
 */
export async function GET() {
  // Check permission — accept either products.manage or settings.manage.
  // This is intentionally simple and linear: try products.manage first
  // (the historical guard), and if FORBIDDEN, try settings.manage.
  // If both throw, the second error propagates.
  try {
    try {
      await requirePermission('products.manage')
    } catch (e: any) {
      // If products.manage failed with FORBIDDEN, try settings.manage
      // before giving up. This allows admin users with only settings
      // permission to upload hero images.
      await requirePermission('settings.manage')
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
