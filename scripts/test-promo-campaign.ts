/**
 * Pure-function tests for the promo campaign state machine + WIB/UTC
 * timezone helpers. No DB, no React — just deterministic assertions.
 *
 * Run with:
 *   bun run scripts/test-promo-campaign.ts
 *
 * Exit code 0 = all pass, 1 = any fail.
 */

import { __test__ } from '../src/components/layout/AnnouncementBar'
import { utcIsoToWibLocalInput, wibLocalInputToUtcIso } from '../src/lib/tz'

const { resolvePromoState, decomposeDelta, NO_PROMO } = __test__

let pass = 0
let fail = 0

function check(name: string, got: unknown, want: unknown) {
  const gotJ = JSON.stringify(got)
  const wantJ = JSON.stringify(want)
  if (gotJ === wantJ) {
    pass++
  } else {
    fail++
    console.error(`  ✗ ${name}`)
    console.error(`    got:  ${gotJ}`)
    console.error(`    want: ${wantJ}`)
  }
}

console.log('== resolvePromoState ==')

// --- promoActive=false → no campaign regardless of timestamps
check(
  'promoActive=false → null',
  resolvePromoState(
    { ...NO_PROMO, promoActive: false, promoStartAt: '2026-08-23T00:00:00+07:00', promoEndAt: '2026-08-23T23:59:00+07:00' },
    Date.parse('2026-08-23T10:00:00+07:00')
  ),
  null
)

// --- promoActive=true but missing datetimes → null (misconfigured)
check(
  'promoActive=true, missing both datetimes → null',
  resolvePromoState({ ...NO_PROMO, promoActive: true }, Date.parse('2026-08-23T10:00:00+07:00')),
  null
)
check(
  'promoActive=true, only startAt → null',
  resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: '2026-08-23T00:00:00+07:00' },
    Date.parse('2026-08-23T10:00:00+07:00')
  ),
  null
)

// --- promoActive=true, start >= end → null (invalid)
check(
  'promoActive=true, start === end → null',
  resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: '2026-08-23T10:00:00+07:00', promoEndAt: '2026-08-23T10:00:00+07:00' },
    Date.parse('2026-08-23T10:00:00+07:00')
  ),
  null
)
check(
  'promoActive=true, start > end → null',
  resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: '2026-08-23T12:00:00+07:00', promoEndAt: '2026-08-23T10:00:00+07:00' },
    Date.parse('2026-08-23T11:00:00+07:00')
  ),
  null
)

// --- BEFORE: now < startAt → countdown to start
{
  const start = '2026-08-23T00:00:00+07:00' // 2026-08-22T17:00:00Z
  const end = '2026-08-23T23:59:00+07:00'  // 2026-08-23T16:59:00Z
  const now = Date.parse('2026-08-22T20:00:00+07:00') // 3h before start
  const r = resolvePromoState(
    {
      ...NO_PROMO, promoActive: true,
      promoTitle: 'Promo 50%',
      promoStartAt: start, promoEndAt: end,
      promoTextBefore: 'Promo 50% mulai dalam',
      promoTextDuring: '🔥 Promo 50% khusus hari ini',
      promoLink: '/produk',
    },
    now
  )
  check('before phase: phase field', r?.phase, 'before')
  check('before phase: target = startMs', r?.targetMs, Date.parse(start))
  check('before phase: text = promoTextBefore', r?.text, 'Promo 50% mulai dalam')
  check('before phase: link passthrough', r?.link, '/produk')
}

// --- BEFORE: text falls back to "{title} mulai dalam" when promoTextBefore is empty
{
  const r = resolvePromoState(
    {
      ...NO_PROMO, promoActive: true,
      promoTitle: 'Promo 50%',
      promoStartAt: '2026-08-23T00:00:00+07:00',
      promoEndAt: '2026-08-23T23:59:00+07:00',
      promoTextBefore: '', promoTextDuring: '',
    },
    Date.parse('2026-08-22T20:00:00+07:00')
  )
  check('before phase: empty promoTextBefore → fallback to title', r?.text, 'Promo 50% mulai dalam')
}

// --- DURING: start ≤ now ≤ end → countdown to end
{
  const start = '2026-08-23T00:00:00+07:00'
  const end = '2026-08-23T23:59:00+07:00'
  const now = Date.parse('2026-08-23T12:00:00+07:00')
  const r = resolvePromoState(
    {
      ...NO_PROMO, promoActive: true,
      promoTitle: 'Promo 50%',
      promoStartAt: start, promoEndAt: end,
      promoTextBefore: 'before text',
      promoTextDuring: '🔥 Promo 50% khusus hari ini',
    },
    now
  )
  check('during phase: phase field', r?.phase, 'during')
  check('during phase: target = endMs', r?.targetMs, Date.parse(end))
  check('during phase: text = promoTextDuring', r?.text, '🔥 Promo 50% khusus hari ini')
}

// --- DURING: at exact start boundary (now === startAt) → during (inclusive)
{
  const start = '2026-08-23T00:00:00+07:00'
  const end = '2026-08-23T23:59:00+07:00'
  const now = Date.parse(start)
  const r = resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: start, promoEndAt: end, promoTextDuring: 'during' },
    now
  )
  check('at start boundary → during', r?.phase, 'during')
}

// --- DURING: at exact end boundary (now === endAt) → during (inclusive)
{
  const start = '2026-08-23T00:00:00+07:00'
  const end = '2026-08-23T23:59:00+07:00'
  const now = Date.parse(end)
  const r = resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: start, promoEndAt: end, promoTextDuring: 'during' },
    now
  )
  check('at end boundary → during (inclusive)', r?.phase, 'during')
}

// --- AFTER: now > endAt → null (promo ended, suppress)
check(
  'after phase: now > endAt → null',
  resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: '2026-08-23T00:00:00+07:00', promoEndAt: '2026-08-23T23:59:00+07:00' },
    Date.parse('2026-08-24T00:00:00+07:00')
  ),
  null
)

// --- Timezone independence: 23 Aug 00:00 WIB = 22 Aug 17:00 UTC.
//     A user in UTC seeing the campaign should compute the same phase as
//     a user in WIB. We test this by feeding the same UTC instant both ways.
{
  // Promo window: 23 Aug 00:00 WIB to 23 Aug 23:59 WIB.
  const start = '2026-08-23T00:00:00+07:00'
  const end = '2026-08-23T23:59:00+07:00'
  // "now" expressed as UTC = the same instant as 23 Aug 12:00 WIB.
  const nowUtc = Date.parse('2026-08-23T05:00:00Z') // = 12:00 WIB
  const nowWib = Date.parse('2026-08-23T12:00:00+07:00')
  check('now via UTC == now via WIB (same instant)', nowUtc, nowWib)
  const r1 = resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: start, promoEndAt: end, promoTextDuring: 'd' },
    nowUtc
  )
  const r2 = resolvePromoState(
    { ...NO_PROMO, promoActive: true, promoStartAt: start, promoEndAt: end, promoTextDuring: 'd' },
    nowWib
  )
  check('phase identical regardless of how "now" was expressed', r1?.phase, r2?.phase)
  check('both yield during', r1?.phase, 'during')
}

console.log()
console.log('== decomposeDelta ==')

// 0 → all zeros
check('0 ms', decomposeDelta(0), { days: 0, hours: 0, minutes: 0, seconds: 0 })
// 1 second
check('1000 ms', decomposeDelta(1000), { days: 0, hours: 0, minutes: 0, seconds: 1 })
// 1 minute
check('60000 ms', decomposeDelta(60_000), { days: 0, hours: 0, minutes: 1, seconds: 0 })
// 1 hour
check('3.6M ms', decomposeDelta(3_600_000), { days: 0, hours: 1, minutes: 0, seconds: 0 })
// 1 day
check('86.4M ms', decomposeDelta(86_400_000), { days: 1, hours: 0, minutes: 0, seconds: 0 })
// Composite
check(
  '1d 2h 3m 4s',
  decomposeDelta(1 * 86_400_000 + 2 * 3_600_000 + 3 * 60_000 + 4_000),
  { days: 1, hours: 2, minutes: 3, seconds: 4 }
)
// Negative → clamped to zero
check('negative clamped', decomposeDelta(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 })

console.log()
console.log('== WIB ↔ UTC conversion (lib/tz) ==')

// 23 Aug 2026 00:00:00 WIB → UTC = 22 Aug 2026 17:00:00Z
check(
  'WIB local input → UTC ISO (00:00 WIB → 17:00 Z prev day)',
  wibLocalInputToUtcIso('2026-08-23T00:00'),
  '2026-08-22T17:00:00.000Z'
)
// 23 Aug 2026 23:59:00 WIB → UTC = 23 Aug 2026 16:59:00Z
check(
  'WIB local input → UTC ISO (23:59 WIB → 16:59 Z same day)',
  wibLocalInputToUtcIso('2026-08-23T23:59'),
  '2026-08-23T16:59:00.000Z'
)
// Round-trip: UTC → WIB input → UTC must be identity (to the minute)
check(
  'round-trip UTC → WIB input → UTC (start)',
  wibLocalInputToUtcIso(utcIsoToWibLocalInput('2026-08-22T17:00:00.000Z')),
  '2026-08-22T17:00:00.000Z'
)
check(
  'round-trip UTC → WIB input → UTC (end)',
  wibLocalInputToUtcIso(utcIsoToWibLocalInput('2026-08-23T16:59:00.000Z')),
  '2026-08-23T16:59:00.000Z'
)
// Null / empty inputs → empty string (no crash)
check('null → ""', wibLocalInputToUtcIso(null), '')
check('empty → ""', wibLocalInputToUtcIso(''), '')
check('null input → ""', utcIsoToWibLocalInput(null), '')
check('empty input → ""', utcIsoToWibLocalInput(''), '')
// Invalid date → empty
check('garbage → ""', wibLocalInputToUtcIso('not-a-date'), '')

console.log()
console.log(`== Results: ${pass} passed, ${fail} failed ==`)
process.exit(fail === 0 ? 0 : 1)
