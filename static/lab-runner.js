// 演習ラボのサンドボックス実行環境（Web Worker）。
// このファイルはWorkerとして読み込まれ、DOM・localStorage・親スコープへ触れない。
// 通信系のグローバルは実行前に取り除き、利用者のコードから同一オリジンAPIを呼べないようにする。

const BLOCKED_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'importScripts',
  'indexedDB',
  'caches',
  'WebSocket',
  'EventSource',
  'Notification',
  'BroadcastChannel',
  'SharedWorker',
  'Worker',
  'navigator',
  'crypto',
]

BLOCKED_GLOBALS.forEach((name) => {
  try {
    Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false })
  } catch {
    try {
      delete self[name]
    } catch {
      // 削除できない環境では未定義化を諦め、実行は続行する。
    }
  }
})

const MAX_LOGS = 50
const MAX_LOG_LENGTH = 500

function formatValue(value, depth = 0) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return depth === 0 ? value : JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'function') return '[function]'
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol') return value.toString()
  if (Array.isArray(value)) return `[${value.map((item) => formatValue(item, depth + 1)).join(', ')}]`
  try {
    return JSON.stringify(value)
  } catch {
    return '[表示できない値]'
  }
}

function isDeepEqual(a, b) {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && isDeepEqual(a[key], b[key]))
}

self.onmessage = (event) => {
  const request = event.data || {}
  if (request.type !== 'run') return

  const logs = []
  const capture = (...args) => {
    if (logs.length >= MAX_LOGS) return
    logs.push(args.map((value) => formatValue(value)).join(' ').slice(0, MAX_LOG_LENGTH))
  }
  self.console = { log: capture, info: capture, warn: capture, error: capture, debug: capture }

  let target
  try {
    // 利用者のコードは関数スコープで評価し、グローバルへの意図しない汚染を抑える。
    const factory = new Function(`"use strict";\n${request.code}\n;return typeof ${request.functionName} === 'function' ? ${request.functionName} : undefined;`)
    target = factory()
  } catch (error) {
    self.postMessage({ type: 'result', logs, error: `コードを読み込めませんでした: ${error.message}`, cases: [] })
    return
  }

  if (typeof target !== 'function') {
    self.postMessage({
      type: 'result',
      logs,
      error: `関数 ${request.functionName} が見つかりません。関数名を変えずに定義してください。`,
      cases: [],
    })
    return
  }

  const cases = (request.cases || []).map((testCase) => {
    try {
      const actual = target(...structuredClone(testCase.args))
      const passed = isDeepEqual(actual, testCase.expected)
      return {
        label: testCase.label,
        argsText: testCase.args.map((value) => formatValue(value, 1)).join(', '),
        expectedText: formatValue(testCase.expected, 1),
        actualText: formatValue(actual, 1),
        passed,
        error: null,
      }
    } catch (error) {
      return {
        label: testCase.label,
        argsText: testCase.args.map((value) => formatValue(value, 1)).join(', '),
        expectedText: formatValue(testCase.expected, 1),
        actualText: null,
        passed: false,
        error: `${error.name}: ${error.message}`,
      }
    }
  })

  self.postMessage({ type: 'result', logs, error: null, cases })
}
