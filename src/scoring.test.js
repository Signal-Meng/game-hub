import { describe, it, expect } from 'vitest'
import {
  speedFactor,
  compositeScore,
  spanScore,
  rateScore,
  computeTps,
  hitRate,
  penaltyRate,
  fmtMs,
  fmtPct,
  fmtScore,
  fmtWithUnit,
  fmtTps,
  getMetrics,
  getRankKey,
} from './scoring.js'

describe('speedFactor', () => {
  it('returns 1 when time <= par', () => {
    expect(speedFactor(1000, 5000)).toBe(1)
    expect(speedFactor(5000, 5000)).toBe(1)
  })
  it('returns par/time when time > par', () => {
    expect(speedFactor(10000, 5000)).toBe(0.5)
  })
  it('returns 0 for null/zero time', () => {
    expect(speedFactor(null, 5000)).toBe(0)
    expect(speedFactor(0, 5000)).toBe(0)
  })
  it('returns 1 when par is null', () => {
    expect(speedFactor(10000, null)).toBe(1)
  })
})

describe('compositeScore', () => {
  it('accuracy × speed factor', () => {
    expect(compositeScore({ accuracy: 100, timeMs: 5000, parMs: 5000 })).toBe(100)
    expect(compositeScore({ accuracy: 100, timeMs: 10000, parMs: 5000 })).toBe(50)
  })
  it('returns null for null accuracy', () => {
    expect(compositeScore({ accuracy: null, timeMs: 1000, parMs: 1000 })).toBeNull()
  })
  it('clamps accuracy to 0~100', () => {
    expect(compositeScore({ accuracy: 150, timeMs: 1000, parMs: 1000 })).toBe(100)
  })
})

describe('spanScore', () => {
  it('returns rounded span', () => {
    expect(spanScore(7)).toBe(7)
    expect(spanScore(7.5)).toBe(8)
  })
  it('returns null for null/NaN', () => {
    expect(spanScore(null)).toBeNull()
    expect(spanScore(NaN)).toBeNull()
  })
  it('clamps negative to 0', () => {
    expect(spanScore(-3)).toBe(0)
  })
})

describe('rateScore', () => {
  it('clamps to 0~100', () => {
    expect(rateScore(50)).toBe(50)
    expect(rateScore(-10)).toBe(0)
    expect(rateScore(150)).toBe(100)
  })
})

describe('computeTps', () => {
  it('units / seconds', () => {
    expect(computeTps(20, 10000)).toBe(2)
    expect(computeTps(10, 4000)).toBe(2.5)
  })
  it('returns null for invalid inputs', () => {
    expect(computeTps(0, 1000)).toBeNull()
    expect(computeTps(10, 0)).toBeNull()
    expect(computeTps(null, 1000)).toBeNull()
  })
})

describe('hitRate', () => {
  it('hits / total as percentage', () => {
    expect(hitRate(8, 10)).toBe(80)
    expect(hitRate(10, 10)).toBe(100)
  })
  it('returns null for zero total', () => {
    expect(hitRate(5, 0)).toBeNull()
  })
})

describe('penaltyRate', () => {
  it('(hits - falseOps) / total', () => {
    expect(penaltyRate(8, 2, 10)).toBe(60)
  })
  it('returns null for zero total', () => {
    expect(penaltyRate(5, 0, 0)).toBeNull()
  })
})

describe('fmtMs', () => {
  it('formats MM:SS.cc', () => {
    expect(fmtMs(0)).toBe('00:00.00')
    expect(fmtMs(65430)).toBe('01:05.43')
  })
  it('returns dash for null', () => {
    expect(fmtMs(null)).toBe('—')
  })
})

describe('fmtPct / fmtScore', () => {
  it('formats values', () => {
    expect(fmtPct(85)).toBe('85%')
    expect(fmtScore(92)).toBe('92')
  })
  it('returns dash for null', () => {
    expect(fmtPct(null)).toBe('—')
    expect(fmtScore(null)).toBe('—')
  })
})

describe('fmtWithUnit / fmtTps', () => {
  it('formats with unit suffix', () => {
    expect(fmtWithUnit('位')(7)).toBe('7 位')
    expect(fmtTps('题')(2.5)).toBe('2.50 题/s')
  })
  it('returns dash for null', () => {
    expect(fmtWithUnit('位')(null)).toBe('—')
    expect(fmtTps('题')(null)).toBe('—')
  })
})

describe('getMetrics', () => {
  it('returns declared metrics', () => {
    const m = getMetrics({ scoring: { metrics: [{ key: 'span' }] } })
    expect(m.length).toBe(1)
  })
  it('falls back to accuracy+time for missing scoring', () => {
    const m = getMetrics({})
    expect(m.map((x) => x.key)).toEqual(['accuracy', 'time'])
  })
})

describe('getRankKey', () => {
  it('returns first metric key', () => {
    expect(getRankKey({ scoring: { metrics: [{ key: 'tps' }, { key: 'score' }] } })).toBe('tps')
  })
  it('falls back to score', () => {
    expect(getRankKey({})).toBe('accuracy')
  })
})
