import type { StakeWithdrawal } from '@/types/transaction'
import type { SuspiciousPattern } from '@/types/alert'
import {
  addWithdrawalToBucket,
  getWithdrawalsInBucket,
  saveAlert,
  isSignatureProcessed,
  markSignaturesProcessed,
  getAlertByDestination,
} from '@/lib/storage/redis'
import { getSeverity, meetsThreshold, THRESHOLDS } from './thresholds'

/**
 * Process new stake withdrawals and detect suspicious patterns
 */
export async function processWithdrawals(
  withdrawals: StakeWithdrawal[]
): Promise<SuspiciousPattern[]> {
  const detectedPatterns: SuspiciousPattern[] = []

  // Filter out already processed signatures
  const newWithdrawals: StakeWithdrawal[] = []
  for (const withdrawal of withdrawals) {
    const processed = await isSignatureProcessed(withdrawal.signature)
    if (!processed) {
      newWithdrawals.push(withdrawal)
    }
  }

  if (newWithdrawals.length === 0) {
    return []
  }

  // Group withdrawals by destination wallet
  const byDestination = new Map<string, StakeWithdrawal[]>()
  for (const withdrawal of newWithdrawals) {
    const existing = byDestination.get(withdrawal.destinationWallet) || []
    existing.push(withdrawal)
    byDestination.set(withdrawal.destinationWallet, existing)
  }

  // Process each destination's withdrawals
  const destinations = Array.from(byDestination.entries())
  for (const [destinationWallet, destWithdrawals] of destinations) {
    // Add each withdrawal to its time bucket
    for (const withdrawal of destWithdrawals) {
      await addWithdrawalToBucket(withdrawal)
    }

    // Check the current time bucket for suspicious patterns
    // Use the most recent withdrawal timestamp as reference
    const latestTimestamp = Math.max(...destWithdrawals.map((w) => w.timestamp))
    const bucketWithdrawals = await getWithdrawalsInBucket(
      destinationWallet,
      latestTimestamp
    )

    // Check if we have enough unique sources
    if (meetsThreshold(bucketWithdrawals.size)) {
      const sourceWallets = Array.from(bucketWithdrawals.keys())
      const transactions = Array.from(bucketWithdrawals.values())

      // Check if there's an existing alert for this destination
      const existingAlert = await getAlertByDestination(destinationWallet)

      // Check if we have any NEW source wallets
      const existingSources = new Set(existingAlert?.sourceWallets || [])
      const newSources = sourceWallets.filter((s) => !existingSources.has(s))

      // Only update if there are new source wallets (or no existing alert)
      if (existingAlert && newSources.length === 0) {
        continue
      }

      // Merge with existing data if alert exists
      let mergedSourceWallets = sourceWallets
      let mergedTransactions = transactions

      if (existingAlert) {
        // Merge source wallets
        const sourceSet = new Set([...existingAlert.sourceWallets, ...sourceWallets])
        mergedSourceWallets = Array.from(sourceSet)

        // Merge transactions (dedupe by signature)
        const txMap = new Map(existingAlert.transactions.map((tx) => [tx.signature, tx]))
        for (const tx of transactions) {
          txMap.set(tx.signature, tx)
        }
        mergedTransactions = Array.from(txMap.values())
      }

      // Calculate window boundaries
      const timestamps = mergedTransactions.map((t) => t.timestamp)
      const windowStart = Math.min(...timestamps)
      const windowEnd = Math.max(...timestamps)

      // Calculate total amount
      const totalAmountSol = mergedTransactions.reduce((sum, t) => sum + t.amountSol, 0)

      const pattern: SuspiciousPattern = {
        id: destinationWallet, // Use destination as ID
        destinationWallet,
        sourceWallets: mergedSourceWallets,
        transactions: mergedTransactions,
        totalAmountSol,
        windowStart,
        windowEnd,
        severity: getSeverity(mergedSourceWallets.length),
        detectedAt: Math.floor(Date.now() / 1000),
      }

      // Save/update the alert
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
