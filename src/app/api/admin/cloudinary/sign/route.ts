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
 * admin browser uses to upload a single product image directly to
 * Cloudinary's REST API. The browser performs the upload itself
 * (multipart/form-data → https://api.cloudinary.com/v1_1/<cloud>/auto/upload)
 * and then sends the resulting secure_url to the regular product create/update
 * API to be stored in ProductImage.url.
 *
 * Security:
 *   - requireAdmin() enforces server-side admin role (same guard as every
 *     other /api/admin/* route). No second auth system.
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
    await requirePermission('products.manage')
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
