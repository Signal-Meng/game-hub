import { describe, it, expect } from 'vitest'
import {
  sortRecords,
  trimRecords,
  groupRecordsByDifficulty,
  deriveBestRecent,
  upsertRecord,
  migrateStats,
  normalizeRecord,
  sampleUnique,
  sampleUniqueExcluding,
  shuffleIndices,
  shuffleArray,
  isDifficulty,
  getOption,
  getParams,
  getPar,
  LEADERBOARD_LIMIT,
} from './difficulty.js'

const rec = (id, difficulty, score, accuracy, time, timestamp = 1000) => ({
  id, difficulty, score, accuracy, time, span: null, tps: null, moves: null, timestamp, migrated: false,
})

describe('isDifficulty', () => {
  it.each(['easy', 'medium', 'hard'])('accepts %s', (v) => {
    expect(isDifficulty(v)).toBe(true)
  })
  it.each([null, undefined, '', 'extreme', 1, {}])('rejects %p', (v) => {
    expect(isDifficulty(v)).toBe(false)
  })
})

describe('sortRecords', () => {
  it('sorts by score descending', () => {
    const list = [rec('a', 'easy', 50), rec('b', 'easy', 90), rec('c', 'easy', 70)]
    expect(sortRecords(list).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
  it('ties broken by time ascending', () => {
    const list = [rec('a', 'easy', 90, null, 5000), rec('b', 'easy', 90, null, 3000)]
    expect(sortRecords(list)[0].id).toBe('b')
  })
  it('does not mutate input', () => {
    const list = [rec('a', 'easy', 50), rec('b', 'easy', 90)]
    sortRecords(list)
    expect(list[0].id).toBe('a')
  })
})

describe('trimRecords', () => {
  it('keeps top N per difficulty independently', () => {
    const easy = Array.from({ length: 15 }, (_, i) => rec(`e${i}`, 'easy', 100 - i))
    const med = Array.from({ length: 15 }, (_, i) => rec(`m${i}`, 'medium', 80 - i))
    const out = trimRecords([...easy, ...med])
    expect(out.filter((r) => r.difficulty === 'easy').length).toBe(LEADERBOARD_LIMIT)
    expect(out.filter((r) => r.difficulty === 'medium').length).toBe(LEADERBOARD_LIMIT)
  })
  it('medium records survive when easy fills up', () => {
    const easy = Array.from({ length: 10 }, (_, i) => rec(`e${i}`, 'easy', 95, null, 2000 + i))
    const med = Array.from({ length: 5 }, (_, i) => rec(`m${i}`, 'medium', 95, null, 15000 + i))
    const out = trimRecords([...easy, ...med])
    expect(out.filter((r) => r.difficulty === 'medium').length).toBe(5)
  })
  it('handles empty input', () => {
    expect(trimRecords([])).toEqual([])
    expect(trimRecords(null)).toEqual([])
  })
})

describe('groupRecordsByDifficulty', () => {
  it('groups non-empty difficulties in key order', () => {
    const list = [rec('m', 'medium', 80), rec('e', 'easy', 90), rec('h', 'hard', 60)]
    const groups = groupRecordsByDifficulty(list)
    expect(groups.map((g) => g.difficulty)).toEqual(['easy', 'medium', 'hard'])
  })
})

describe('deriveBestRecent', () => {
  it('computes best as max for higherIsBetter', () => {
    const list = [rec('a', 'easy', null, 80), rec('b', 'easy', null, 95)]
    const d = deriveBestRecent(list, 'easy', [{ key: 'accuracy', higherIsBetter: true }])
    expect(d.accuracy.best).toBe(95)
  })
  it('computes best as min for lowerIsBetter (time)', () => {
    const list = [rec('a', 'easy', null, 90, 20000), rec('b', 'easy', null, 90, 10000)]
    const d = deriveBestRecent(list, 'easy', [{ key: 'time', higherIsBetter: false }])
    expect(d.time.best).toBe(10000)
  })
  it('returns null best for empty difficulty', () => {
    const d = deriveBestRecent([], 'easy')
    expect(d.accuracy.best).toBeNull()
  })
})

describe('upsertRecord', () => {
  it('same id updates in place without growing', () => {
    const r1 = rec('g:easy:1', 'easy', 50, 50, 5000)
    const r2 = { ...rec('g:easy:1', 'easy', 70, 70, 4000), timestamp: 1000 }
    const out = upsertRecord([r1], r2)
    expect(out.length).toBe(1)
    expect(out[0].score).toBe(70)
  })
  it('new id appends', () => {
    const r1 = rec('g:easy:1', 'easy', 50, 50, 5000)
    const r2 = rec('g:easy:2', 'easy', 70, 70, 4000)
    expect(upsertRecord([r1], r2).length).toBe(2)
  })
})

describe('migrateStats', () => {
  it('converts old best/recent shape', () => {
    const raw = { accuracy: { best: 92, recent: 88 }, time: { best: 38120, recent: 45600 } }
    const out = migrateStats(raw)
    expect(out.v).toBe(1)
    expect(out.records.length).toBe(2)
    expect(out.records[0].difficulty).toBe('medium')
    expect(out.records[0].migrated).toBe(true)
  })
  it.each([null, undefined, [], {}, 'abc', 0])('does not throw for %p', (raw) => {
    expect(migrateStats(raw).v).toBe(1)
  })
})

describe('normalizeRecord', () => {
  it('fills defaults for missing fields', () => {
    const r = normalizeRecord({})
    expect(r.difficulty).toBe('medium')
    expect(r.score).toBeNull()
    expect(r.accuracy).toBeNull()
  })
  it('falls back score to accuracy for legacy records', () => {
    const r = normalizeRecord({ accuracy: 85, timestamp: 1000 })
    expect(r.score).toBe(85)
  })
})

describe('sampleUnique', () => {
  it('returns k unique indices in [0, n)', () => {
    for (let i = 0; i < 100; i++) {
      const out = sampleUnique(10, 5)
      expect(new Set(out).size).toBe(5)
      out.forEach((v) => expect(v).toBeGreaterThanOrEqual(0))
      out.forEach((v) => expect(v).toBeLessThan(10))
    }
  })
  it('degrades to full set when k > n', () => {
    expect(sampleUnique(3, 10).length).toBe(3)
  })
})

describe('sampleUniqueExcluding', () => {
  it('excludes given indices', () => {
    for (let i = 0; i < 100; i++) {
      const out = sampleUniqueExcluding(4, 3, [0])
      expect(out).not.toContain(0)
      expect(out.length).toBe(3)
    }
  })
})

describe('shuffleIndices / shuffleArray', () => {
  it('shuffleIndices preserves range', () => {
    const out = shuffleIndices(20)
    expect(out.length).toBe(20)
    expect(new Set(out).size).toBe(20)
  })
  it('shuffleArray preserves elements', () => {
    const input = [1, 2, 3, 4, 5]
    expect(shuffleArray(input).sort()).toEqual(input.sort())
  })
})

describe('getOption / getParams / getPar', () => {
  const game = {
    difficulties: {
      easy: { label: '简单', summary: 's', params: { size: 3 }, par: 20000 },
    },
  }
  it('returns declared option', () => {
    const o = getOption(game, 'easy')
    expect(o.params.size).toBe(3)
    expect(o.par).toBe(20000)
  })
  it('returns fallback for missing difficulty', () => {
    const o = getOption(game, 'hard')
    expect(o.params).toEqual({})
    expect(o.par).toBeUndefined()
  })
  it('getParams delegates to getOption', () => {
    expect(getParams(game, 'easy')).toEqual({ size: 3 })
    expect(getPar(game, 'easy')).toBe(20000)
  })
})
