/**
 * Static verification of Cloudinary signature algorithm.
 *
 * This script does NOT make any network call — it only verifies that
 * `signUploadParams` produces a deterministic SHA-1 signature that matches
 * the documented Cloudinary algorithm:
 *   signature = SHA1(`folder=<folder>&timestamp=<ts>` + apiSecret)
 *
 * Reference:
 *   https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 *
 * Usage: bun run scripts/verify-cloudinary-signature.ts
 *
 * Pass condition:
 *   1. The signature matches the value computed independently by Node's
 *      crypto module (proving the library does exactly what Cloudinary docs say).
 *   2. The signature is deterministic for the same inputs.
 *   3. Different inputs produce different signatures.
 */

import crypto from 'crypto'
import {
  signUploadParams,
  buildSignatureResponse,
  getCloudinaryConfig,
  PRODUCT_UPLOAD_FOLDER,
  type CloudinaryConfig,
} from '../src/lib/cloudinary'

// Use a fake-but-fixed config so the test is reproducible without real credentials.
const FAKE_CONFIG: CloudinaryConfig = {
  cloudName: 'test-cloud',
  apiKey: '123456789012345',
  apiSecret: 'fake-secret-DO-NOT-USE-IN-PROD',
}

function independentSignature(params: Record<string, string | number>, apiSecret: string, timestamp: number) {
  const toSign = { ...params, timestamp }
  const sortedKeys = Object.keys(toSign).sort()
  const paramsString = sortedKeys.map((k) => `${k}=${toSign[k]}`).join('&')
  const stringToSign = `${paramsString}${apiSecret}`
  return crypto.createHash('sha1').update(stringToSign).digest('hex')
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✓ ${msg}`)
}

// === Test 1: signature matches independent SHA-1 computation ===
const params = { folder: PRODUCT_UPLOAD_FOLDER }
const { signature, timestamp } = signUploadParams(FAKE_CONFIG, params)
const expected = independentSignature(params, FAKE_CONFIG.apiSecret, timestamp)
assert(signature === expected, 'Signature matches independent SHA-1 computation')
assert(signature.length === 40, `Signature is 40-char hex (got ${signature.length})`)
assert(/^[0-9a-f]+$/.test(signature), 'Signature is lowercase hex')

// === Test 2: deterministic for same inputs ===
const r1 = signUploadParams(FAKE_CONFIG, { folder: 'a/b' })
// We can't reuse the same timestamp because signUploadParams uses Date.now(),
// but the algorithm itself must be deterministic given fixed inputs. Re-compute
// with the same timestamp and verify.
const recomputed = independentSignature({ folder: 'a/b' }, FAKE_CONFIG.apiSecret, r1.timestamp)
assert(r1.signature === recomputed, 'Signature is deterministic for same inputs')

// === Test 3: different folder → different signature ===
const r2 = signUploadParams(FAKE_CONFIG, { folder: 'different/folder' })
assert(r2.signature !== r1.signature, 'Different folders produce different signatures')

// === Test 4: different secret → different signature (server-side secret matters) ===
const otherConfig = { ...FAKE_CONFIG, apiSecret: 'another-secret' }
const r3 = signUploadParams(otherConfig, { folder: 'a/b' })
// Note: timestamps differ by ~0-1 second — that ALONE changes the signature.
// To isolate, recompute r3's signature using r1's timestamp but otherConfig's secret:
const r3_with_r1_ts = independentSignature({ folder: 'a/b' }, otherConfig.apiSecret, r1.timestamp)
assert(r3_with_r1_ts !== r1.signature, 'Different API secret produces different signature')

// === Test 5: buildSignatureResponse returns all required fields ===
const resp = buildSignatureResponse(FAKE_CONFIG, PRODUCT_UPLOAD_FOLDER)
assert(typeof resp.signature === 'string' && resp.signature.length === 40, 'buildSignatureResponse.signature')
assert(typeof resp.timestamp === 'number', 'buildSignatureResponse.timestamp')
assert(resp.apiKey === FAKE_CONFIG.apiKey, 'buildSignatureResponse.apiKey')
assert(resp.cloudName === FAKE_CONFIG.cloudName, 'buildSignatureResponse.cloudName')
assert(resp.folder === PRODUCT_UPLOAD_FOLDER, `buildSignatureResponse.folder = ${PRODUCT_UPLOAD_FOLDER}`)

// === Test 6: getCloudinaryConfig respects env vars ===
const saved: Record<string, string | undefined> = {}
for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  saved[k] = process.env[k]
  delete process.env[k]
}
assert(getCloudinaryConfig() === null, 'getCloudinaryConfig returns null when env vars missing')

process.env.CLOUDINARY_CLOUD_NAME = 'mycloud'
assert(getCloudinaryConfig() === null, 'getCloudinaryConfig returns null when only cloud name set')

process.env.CLOUDINARY_API_KEY = 'key'
assert(getCloudinaryConfig() === null, 'getCloudinaryConfig returns null when secret missing')

process.env.CLOUDINARY_API_SECRET = 'secret'
const cfg = getCloudinaryConfig()
assert(cfg !== null && cfg.cloudName === 'mycloud', 'getCloudinaryConfig returns config when all env vars set')
assert(cfg?.apiKey === 'key' && cfg.apiSecret === 'secret', 'getCloudinaryConfig preserves key + secret')

// Restore env
for (const [k, v] of Object.entries(saved)) {
  if (v === undefined) delete process.env[k]
  else process.env[k] = v
}

console.log('\nAll static verification tests passed ✓')
console.log('  Algorithm: SHA-1(sorted_params + api_secret)')
console.log('  Endpoint:   /api/admin/cloudinary/sign (requireAdmin-guarded)')
console.log('  Upload URL: https://api.cloudinary.com/v1_1/<cloud>/auto/upload')
console.log('  Folder:     ', PRODUCT_UPLOAD_FOLDER)
console.log('\nNote: live upload testing requires real CLOUDINARY_* env vars in Coolify.')
