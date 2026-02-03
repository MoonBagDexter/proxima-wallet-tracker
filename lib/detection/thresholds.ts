import type { Severity } from '@/types/alert'

/**
 * Detection thresholds configuration
 */
export const THRESHOLDS = {
  // Minimum number of unique source wallets to flag as suspicious
  MIN_SOURCE_WALLETS: 3,

  // Time window in seconds for grouping transactions
  TIME_WINDOW_SECONDS: 5 * 60, // 5 minutes

  // Severity thresholds based on source wallet count
  SEVERITY: {
    LOW: { min: 3, max: 4 },
    MEDIUM: { min: 5, max: 9 },
    HIGH: { min: 10, max: 19 },
    CRITICAL: { min: 20, max: Infinity },
  },
} as const

/**
 * Determine severity based on number of source wallets
 */
export function getSeverity(sourceWalletCount: number): Severity {
  if (sourceWalletCount >= THRESHOLDS.SEVERITY.CRITICAL.min) {
    return 'critical'
  }
  if (sourceWalletCount >= THRESHOLDS.SEVERITY.HIGH.min) {
    return 'high'
  }
  if (sourceWalletCount >= THRESHOLDS.SEVERITY.MEDIUM.min) {
    return 'medium'
  }
  return 'low'
}

/**
 * Check if a wallet count meets the minimum threshold
 */
export function meetsThreshold(sourceWalletCount: number): boolean {
  return sourceWalletCount >= THRESHOLDS.MIN_SOURCE_WALLETS
}
