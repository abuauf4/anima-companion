/**
 * Cloudinary server-side helpers.
 *
 * Goal: enable admin product image uploads WITHOUT exposing the
 * CLOUDINARY_API_SECRET to the browser. We do this by signing the
 * upload parameters server-side and returning a short-lived signature
 * the browser uses together with the public API key.
 *
 * No external npm dependency is needed — Cloudinary's signed-upload
 * algorithm is just `SHA-1(secret + payload)` and Node's built-in
 * `crypto` module can compute it. This keeps the bundle tiny and
 * avoids a second auth system (we reuse requireAdmin()).
 *
 * Secrets are read ONLY from server-side env vars:
 *   - CLOUDINARY_CLOUD_NAME   (public, ok to send to client)
 *   - CLOUDINARY_API_KEY      (public identifier, ok to send to client)
 *   - CLOUDINARY_API_SECRET   (server-only, NEVER exposed)
 *
 * If any of these is missing, the admin upload UI shows a clear
 * "Cloudinary not configured" message instead of failing at upload time.
 */

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export interface CloudinarySignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
  /** Optional upload preset name, if configured in Cloudinary dashboard. */
  uploadPreset?: string
}

/**
 * Read Cloudinary config from server env. Returns null if any required
 * variable is missing — callers should surface a clear "not configured"
 * message rather than attempting a doomed upload.
 */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName, apiKey, apiSecret }
}

/**
 * The Cloudinary folder for new admin product media.
 * Predictable location: anima/products/<auto-id>
 * (Cloudinary generates the public_id automatically inside the folder.)
 */
export const PRODUCT_UPLOAD_FOLDER = 'anima/products'

/**
 * Generate a Cloudinary signed-upload signature.
 *
 * Cloudinary's signed-upload flow:
 *   1. Server builds a sorted params string: `key1=value1&key2=value2&...&timestamp=N`
 *      (params joined with `&`, sorted alphabetically by key).
 *   2. Append the API_SECRET (without a `&`): `params+apiSecret`.
 *   3. SHA-1 hex digest of that string is the `signature`.
 *   4. Client POSTs multipart/form-data to
 *      `https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload`
 *      with: file, api_key, timestamp, signature, folder, (optional) upload_preset.
 *
 * Reference: https://cloudinary.com/documentation/upload_images#signed_upload
 */
export function signUploadParams(
  config: CloudinaryConfig,
  params: Record<string, string | number>,
): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000)
  // Build the params map to sign — timestamp must be included.
  const toSign: Record<string, string | number> = { ...params, timestamp }
  // Sort alphabetically by key, join with '&', no trailing '&'.
  const sortedKeys = Object.keys(toSign).sort()
  const paramsString = sortedKeys.map((k) => `${k}=${toSign[k]}`).join('&')
  // Append secret without separator.
  const stringToSign = `${paramsString}${config.apiSecret}`

  // Use Node's built-in crypto — works in all Next.js runtimes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto')
  const signature = crypto.createHash('sha1').update(stringToSign).digest('hex')
  return { signature, timestamp }
}

/**
 * Build the full response payload the admin-only signature endpoint
 * returns to the browser.
 */
export function buildSignatureResponse(
  config: CloudinaryConfig,
  folder: string = PRODUCT_UPLOAD_FOLDER,
): CloudinarySignature {
  const { signature, timestamp } = signUploadParams(config, { folder })
  return {
    signature,
    timestamp,
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    folder,
  }
}

/**
 * The Cloudinary upload endpoint URL for the given cloud name.
 * Used by the browser to POST the actual file (multipart/form-data).
 */
export function cloudinaryUploadUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`
}

/**
 * Returns true iff a stored ProductImage URL is a Cloudinary delivery URL.
 * Lets the admin UI and the public Image component tell local `/products/...`
 * paths apart from `https://res.cloudinary.com/...` URLs.
 */
export function isCloudinaryUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('https://res.cloudinary.com/')
}
