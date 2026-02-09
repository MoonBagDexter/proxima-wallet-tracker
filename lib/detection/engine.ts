import type { StakeWithdrawal } from '@/types/transaction'
import type { SuspiciousPattern } from '@/types/alert'
import {
  addWithdrawalToBucket,
  getWithdrawalsInBucket,
  saveAlert,
  getProcessedSignatures,
  markSignaturesProcessed,
} from '@/lib/storage/json-storage'
import { getSeverity, meetsThreshold, THRESHOLDS } from './thresholds'

/**
 * Get the time window start for a given timestamp
 */
function getWindowStart(timestamp: number): number {
  return Math.floor(timestamp / THRESHOLDS.TIME_WINDOW_SECONDS) * THRESHOLDS.TIME_WINDOW_SECONDS
}

/**
 * Process new stake withdrawals and detect suspicious patterns.
 * Each 5-minute time window produces its own independent alert.
 */
export async function processWithdrawals(
  withdrawals: StakeWithdrawal[]
): Promise<SuspiciousPattern[]> {
  const detectedPatterns: SuspiciousPattern[] = []

  // Filter out already processed signatures (batch check - single Redis call)
  const allSignatures = withdrawals.map(w => w.signature)
  const processedSignatures = await getProcessedSignatures(allSignatures)
  const newWithdrawals = withdrawals.filter(w => !processedSignatures.has(w.signature))

  if (newWithdrawals.length === 0) {
    return []
  }

  // Group withdrawals by destination wallet AND time window
  const byBucket = new Map<string, StakeWithdrawal[]>()
  for (const withdrawal of newWithdrawals) {
    const windowStart = getWindowStart(withdrawal.timestamp)
    const bucketKey = `${withdrawal.destinationWallet}:${windowStart}`
    const existing = byBucket.get(bucketKey) || []
    existing.push(withdrawal)
    byBucket.set(bucketKey, existing)
  }

  // Process each destination+window bucket
  const buckets = Array.from(byBucket.entries())
  for (const [bucketKey, destWithdrawals] of buckets) {
    const [destinationWallet] = bucketKey.split(':')

    // Add each withdrawal to its time bucket in Redis
    for (const withdrawal of destWithdrawals) {
      await addWithdrawalToBucket(withdrawal)
    }

    // Check the current time bucket for suspicious patterns
    const latestTimestamp = Math.max(...destWithdrawals.map((w) => w.timestamp))
    const bucketWithdrawals = await getWithdrawalsInBucket(
      destinationWallet,
      latestTimestamp
    )

    // Check if we have enough unique sources
    if (meetsThreshold(bucketWithdrawals.size)) {
      const sourceWallets = Array.from(bucketWithdrawals.keys())
      const transactions = Array.from(bucketWithdrawals.values())

      const timestamps = transactions.map((t) => t.timestamp)
      const windowStart = Math.min(...timestamps)
      const windowEnd = Math.max(...timestamps)
      const totalAmountSol = transactions.reduce((sum, t) => sum + t.amountSol, 0)

      // Use destination:windowStart as ID so each time window is a separate alert
      const alertId = `${destinationWallet}:${getWindowStart(latestTimestamp)}`

      const pattern: SuspiciousPattern = {
        id: alertId,
        destinationWallet,
        sourceWallets,
        transactions,
        totalAmountSol,
        windowStart,
        windowEnd,
        severity: getSeverity(sourceWallets.length),
        detectedAt: Math.floor(Date.now() / 1000),
      }

      await saveAlert(pattern)
      detectedPatterns.push(pattern)
    }
  }

  // Mark all processed signatures
  await markSignaturesProcessed(newWithdrawals.map((w) => w.signature))

  return detectedPatterns
}

/**
 * Analyze a batch of withdrawals for patterns without saving
 * (useful for testing)
 */
export function analyzeWithdrawals(
  withdrawals: StakeWithdrawal[]
): Map<string, StakeWithdrawal[]> {
  // Group by destination wallet and time window
  const buckets = new Map<string, Map<string, StakeWithdrawal>>()

  for (const withdrawal of withdrawals) {
    const windowStart =
      Math.floor(withdrawal.timestamp / THRESHOLDS.TIME_WINDOW_SECONDS) *
      THRESHOLDS.TIME_WINDOW_SECONDS
    const bucketKey = `${withdrawal.destinationWallet}:${windowStart}`

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, new Map())
    }

    // Use source wallet as key to deduplicate
    buckets.get(bucketKey)!.set(withdrawal.sourceWallet, withdrawal)
  }

  // Convert to result format, filtering by threshold
  const result = new Map<string, StakeWithdrawal[]>()

  const bucketEntries = Array.from(buckets.entries())
  for (const [bucketKey, sources] of bucketEntries) {
    if (meetsThreshold(sources.size)) {
      const destinationWallet = bucketKey.split(':')[0]
      const existingKey = Array.from(result.keys()).find((k) =>
        k.startsWith(destinationWallet)
      )

      if (existingKey) {
        // Merge with existing
        const existing = result.get(existingKey)!
        const sourceValues = Array.from(sources.values())
        for (const withdrawal of sourceValues) {
          if (!existing.find((e) => e.sourceWallet === withdrawal.sourceWallet)) {
            existing.push(withdrawal)
          }
        }
      } else {
        result.set(bucketKey, Array.from(sources.values()))
      }
    }
  }

  return result
}
