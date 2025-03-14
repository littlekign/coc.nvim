'use strict'
import { findIndex } from '../util/array'
import { getCharCodes, wordChar, caseMatch } from '../util/fuzzy'
import { getNextWord } from '../util/string'

/**
 * Score and positions
 */
export type MatchResult = [number, ReadonlyArray<number>] | undefined

export function caseScore(input: number, curr: number, divide = 1): number {
  if (input === curr) return 1 / divide
  if (caseMatch(input, curr)) return 0.5 / divide
  return 0
}

/**
 * Rules:
 * - First strict 5, first case match 2.5
 * - First word character strict 2.5, first word character case 2
 * - First fuzzy match strict 1, first fuzzy case 0.5
 * - Follow strict 1, follow case 0.5
 * - Follow word start 1, follow word case 0.75
 * - First fuzzy strict 0.1, first fuzzy case 0.05
 * @public
 * @param {string} word
 * @param {number[]} input
 * @returns {number}
 */
export function matchScore(word: string, input: Uint16Array): number {
  if (input.length == 0 || word.length < input.length) return 0
  let next = nextScore(getCharCodes(word), 0, input, [])
  return next == null ? 0 : next[0]
}

export function matchScoreWithPositions(word: string, input: Uint16Array): [number, ReadonlyArray<number>] | undefined {
  if (input.length == 0 || word.length < input.length) return undefined
  return nextScore(getCharCodes(word), 0, input, [])
}

/**
 * Return score and positions.
 */
function nextScore(codes: Uint16Array, index: number, inputCodes: Uint16Array, positions: ReadonlyArray<number>, inputIndex = 0): MatchResult {
  let input = inputCodes[inputIndex]
  if (input === undefined) return [0, positions]
  let len = codes.length
  // let nextCodes = inputCodes.slice(1)
  let nextIndex = inputIndex + 1
  // not alphabet
  if (!wordChar(input)) {
    let idx = findIndex(codes, input, index)
    if (idx == -1) return undefined
    let score = idx == 0 ? 5 : 1
    let next = nextScore(codes, idx + 1, inputCodes, [...positions, idx], nextIndex)
    return next === undefined ? undefined : [score + next[0], next[1]]
  }
  // check beginning
  let isStart = index === 0
  let score = caseScore(input, codes[index], isStart ? 0.2 : 1)
  if (score > 0) {
    let next = nextScore(codes, index + 1, inputCodes, [...positions, index], nextIndex)
    return next === undefined ? undefined : [score + next[0], next[1]]
  }
  // check next word
  let positionMap: Map<number, ReadonlyArray<number>> = new Map()
  let word = getNextWord(codes, index + 1)
  if (word != null) {
    let score = caseScore(input, word[1], isStart ? 0.5 : 1)
    if (score > 0) {
      let ps = [...positions, word[0]]
      if (score === 0.5) score = 0.75
      let next = nextScore(codes, word[0] + 1, inputCodes, ps, nextIndex)
      if (next !== undefined) positionMap.set(score + next[0], next[1])
    }
  }
  // find fuzzy
  for (let i = index + 1; i < len; i++) {
    let score = caseScore(input, codes[i], isStart ? 1 : 10)
    if (score > 0) {
      let next = nextScore(codes, i + 1, inputCodes, [...positions, i], nextIndex)
      if (next !== undefined) positionMap.set(score + next[0], next[1])
      break
    }
  }
  if (positionMap.size == 0) {
    // Try match previous position
    if (positions.length > 0) {
      let last = positions[positions.length - 1]
      if (last > 0 && codes[last] !== input && codes[last - 1] === input) {
        let ps = positions.slice()
        ps.splice(positions.length - 1, 0, last - 1)
        let next = nextScore(codes, last + 1, inputCodes, ps, nextIndex)
        if (next === undefined) return undefined
        return [0.5 + next[0], next[1]]
      }
    }
    return undefined
  }
  let max = Math.max(...positionMap.keys())
  return [max, positionMap.get(max)]
}
