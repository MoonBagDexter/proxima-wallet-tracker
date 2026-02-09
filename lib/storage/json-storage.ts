import type { SuspiciousPattern, DashboardStats } from '@/types/alert'
import type { StakeWithdrawal } from '@/types/transaction'
import { TTL, type StorageSchema } from './types'

// Pure in-memory storage (resets on deploy, which is fine for ephemeral alert data)
let memoryStorage: StorageSchema | null = null

function getEmptyStorage(): StorageSchema {
  return {
    version: 1,
    alerts: {},
    alertsList: [],
    withdrawalBuckets: {},
    processedSignatures: [],
    processedSignaturesExpiresAt: 0,
    stats: {
      lastPoll: null,
      txScanned: 0,
    },
    lastUpdate: Date.now(),
  }
}

function cleanupExpired(storage: StorageSchema): StorageSchema {
  const now = Date.now()

  // Clean alerts
  for (const id of Object.keys(storage.alerts)) {
    if (storage.alerts[id].expiresAt < now) {
      delete storage.alerts[id]
    }
  }

  // Clean alerts list (remove IDs with no corresponding alert)
  storage.alertsList = storage.alertsList.filter(
    item => storage.alerts[item.id] !== undefined
  )

  // Clean withdrawal buckets
  for (const key of Object.keys(storage.withdrawalBuckets)) {
    if (storage.withdrawalBuckets[key].expiresAt < now) {
      delete storage.withdrawalBuckets[key]
    }
  }

  // Clean processed signatures if expired
  if (storage.processedSignaturesExpiresAt < now) {
    storage.processedSignatures = []
    storage.processedSignaturesExpiresAt = 0
  }

  return storage
}

function getStorage(): StorageSchema {
  if (!memoryStorage) {
    memoryStorage = getEmptyStorage()
  }
  memoryStorage = cleanupExpired(memoryStorage)
  return memoryStorage
}

function updateStorage(updater: (storage: StorageSchema) => void): void {
  const storage = getStorage()
  updater(storage)
}

/**
 * Get the bucket key for a destination wallet at a specific time window
 */
function getBucketKey(destinationWallet: string, timestamp: number): string {
  const windowStart = Math.floor(timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000)
  return `${destinationWallet}:${windowStart}`
}

/**
 * Trigger update notification for real-time frontend updates
 */
export async function triggerUpdate(): Promise<void> {
  updateStorage(storage => {
    storage.lastUpdate = Date.now()
  })
}

/**
 * Get the last update timestamp (for SSE polling)
 */
export async function getLastUpdate(): Promise<number> {
  const storage = getStorage()
  return storage.lastUpdate
}

/**
 * Add a withdrawal to the appropriate time bucket for its destination
 */
export async function addWithdrawalToBucket(
  withdrawal: StakeWithdrawal
): Promise<void> {
  updateStorage(storage => {
    const bucketKey = getBucketKey(withdrawal.destinationWallet, withdrawal.timestamp)

    if (!storage.withdrawalBuckets[bucketKey]) {
      storage.withdrawalBuckets[bucketKey] = {
        data: {},
        expiresAt: Date.now() + TTL.WITHDRAWAL_BUCKET,
      }
    }

    storage.withdrawalBuckets[bucketKey].data[withdrawal.sourceWallet] = withdrawal
    storage.withdrawalBuckets[bucketKey].expiresAt = Date.now() + TTL.WITHDRAWAL_BUCKET
  })
}

/**
 * Get all withdrawals in the current bucket for a destination
 */
export async function getWithdrawalsInBucket(
  destinationWallet: string,
  timestamp: number
): Promise<Map<string, StakeWithdrawal>> {
  const storage = getStorage()
  const bucketKey = getBucketKey(destinationWallet, timestamp)
  const withdrawals = new Map<string, StakeWithdrawal>()

  const bucket = storage.withdrawalBuckets[bucketKey]
  if (bucket) {
    for (const [sourceWallet, withdrawal] of Object.entries(bucket.data)) {
      withdrawals.set(sourceWallet, withdrawal)
    }
  }

  return withdrawals
}

/**
 * Save a suspicious pattern alert.
 * Skips if an alert with the same ID already exists.
 */
export async function saveAlert(pattern: SuspiciousPattern): Promise<void> {
  const storage = getStorage()
  const alertId = pattern.id

  // Skip if exists
  if (storage.alerts[alertId]) {
    return
  }

  updateStorage(storage => {
    storage.alerts[alertId] = {
      data: { ...pattern, id: alertId },
      expiresAt: Date.now() + TTL.ALERTS,
    }

    // Add to sorted list
    storage.alertsList.push({ id: alertId, score: pattern.detectedAt })

    // Sort by score (detection time)
    storage.alertsList.sort((a, b) => a.score - b.score)

    // Trim to last 1000
    if (storage.alertsList.length > 1000) {
      const removed = storage.alertsList.splice(0, storage.alertsList.length - 1000)
      for (const item of removed) {
        delete storage.alerts[item.id]
      }
    }

    storage.lastUpdate = Date.now()
  })
}

/**
 * Get existing alert for a destination wallet
 */
export async function getAlertByDestination(destinationWallet: string): Promise<SuspiciousPattern | null> {
  const storage = getStorage()
  const entry = storage.alerts[destinationWallet]
  return entry?.data || null
}

/**
 * Get recent alerts
 */
export async function getAlerts(limit = 50): Promise<SuspiciousPattern[]> {
  const storage = getStorage()

  // Get the last N alert IDs (newest first)
  const recentIds = storage.alertsList.slice(-limit)

  const alerts: SuspiciousPattern[] = []
  for (const item of recentIds) {
    const entry = storage.alerts[item.id]
    if (entry) {
      alerts.push(entry.data)
    }
  }

  return alerts.reverse()
}

/**
 * Get a specific alert by ID
 */
export async function getAlert(id: string): Promise<SuspiciousPattern | null> {
  const storage = getStorage()
  const entry = storage.alerts[id]
  return entry?.data || null
}

/**
 * Update stats after polling
 */
export async function updateStats(
  transactionsScanned: number,
  pollTime: number
): Promise<void> {
  updateStorage(storage => {
    storage.stats.lastPoll = pollTime
    storage.stats.txScanned += transactionsScanned
    storage.lastUpdate = Date.now()
  })
}

/**
 * Get dashboard statistics
 */
export async function getStats(): Promise<DashboardStats> {
  const storage = getStorage()

  const todayStart = Date.now() - 24 * 60 * 60 * 1000

  const alertsBySeverity = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }

  let totalAlertsToday = 0

  for (const item of storage.alertsList) {
    if (item.score >= todayStart) {
      const entry = storage.alerts[item.id]
      if (entry) {
        alertsBySeverity[entry.data.severity]++
        totalAlertsToday++
      }
    }
  }

  return {
    totalAlertsToday,
    criticalCount: alertsBySeverity.critical,
    transactionsScanned: storage.stats.txScanned,
    lastPollTime: storage.stats.lastPoll,
    alertsBySeverity,
  }
}

/**
 * Check if a signature has already been processed
 */
export async function isSignatureProcessed(signature: string): Promise<boolean> {
  const storage = getStorage()
  return storage.processedSignatures.includes(signature)
}

/**
 * Batch check which signatures have been processed
 */
export async function getProcessedSignatures(signatures: string[]): Promise<Set<string>> {
  if (signatures.length === 0) return new Set()

  const storage = getStorage()
  const processedSet = new Set(storage.processedSignatures)
  const result = new Set<string>()

  for (const sig of signatures) {
    if (processedSet.has(sig)) {
      result.add(sig)
    }
  }

  return result
}

/**
 * Mark signatures as processed
 */
export async function markSignaturesProcessed(signatures: string[]): Promise<void> {
  if (signatures.length === 0) return

  updateStorage(storage => {
    const processedSet = new Set(storage.processedSignatures)
    for (const sig of signatures) {
      processedSet.add(sig)
    }
    storage.processedSignatures = Array.from(processedSet)
    storage.processedSignaturesExpiresAt = Date.now() + TTL.PROCESSED_SIGNATURES
  })
}

/**
 * Clear alerts data (keeps processed signatures)
 */
export async function clearAll(): Promise<void> {
  updateStorage(storage => {
    storage.alerts = {}
    storage.alertsList = []
    storage.lastUpdate = Date.now()
  })
}
