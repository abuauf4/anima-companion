/**
 * Timezone helpers for the promo campaign UI.
 *
 * Source of truth: Asia/Jakarta (WIB, UTC+7). Admin enters datetimes in
 * WIB; the server stores them as UTC; the storefront compares them against
 * Date.now() (UTC ms). This module handles the WIB ↔ UTC conversion so
 * the server never needs to know about timezones.
 *
 * We avoid relying on Intl.DateTimeFormat for the conversion because
 * V8's IANA timezone database is platform-dependent (Node vs. Bun vs.
 * browser can differ). Instead, we hardcode the UTC+7 offset for WIB.
 * Indonesia has NOT observed DST since 1964, and there are no plans to
 * reintroduce it — so a fixed +07:00 is correct and stable.
 */

export const WIB_OFFSET_MINUTES = 7 * 60 // Asia/Jakarta = UTC+7, no DST

/**
 * Convert a UTC ISO string (from the server) into a "YYYY-MM-DDTHH:mm"
 * string suitable for an <input type="datetime-local"> that should
 * DISPLAY the time in Asia/Jakarta.
 *
 * Returns "" when the input is null/empty.
 */
export function utcIsoToWibLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  if (!isFinite(ms)) return ''
  // Shift the UTC instant forward by 7h so that toISOString() produces
  // a string whose YYYY-MM-DDTHH:mm components look like the WIB wall-clock.
  const wibMs = ms + WIB_OFFSET_MINUTES * 60_000
  return new Date(wibMs).toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
}

/**
 * Convert a "YYYY-MM-DDTHH:mm" value from <input type="datetime-local">
 * (interpreted as Asia/Jakarta wall-clock) into a UTC ISO string for
 * sending to the server.
 *
 * Returns "" when the input is null/empty/invalid.
 */
export function wibLocalInputToUtcIso(local: string | null | undefined): string {
  if (!local) return ''
  // local looks like "2026-08-23T00:00"
  // Append +07:00 to make it an absolute instant, then the JS Date
  // constructor parses it into a UTC ms timestamp. We re-serialize as
  // UTC Z so the server (Prisma DateTime) gets a clean UTC value.
  const d = new Date(`${local}:00+07:00`)
  if (!isFinite(d.getTime())) return ''
  return d.toISOString()
}
