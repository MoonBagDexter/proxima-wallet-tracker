import { Redis } from '@upstash/redis'
import type { SuspiciousPattern, DashboardStats } from '@/types/alert'
import type { StakeWithdrawal } from '@/types/transaction'

// Redis key prefixes
const KEYS = {
  ALERTS: 'alerts',
  ALERTS_LIST: 'alerts:list',
  WITHDRAWAL_BUCKET: 'withdrawals:bucket',
  STATS: 'stats',
  LAST_POLL: 'stats:lastPoll',
  TRANSACTIONS_SCANNED: 'stats:txScanned',
  PROCESSED_SIGNATURES: 'processed:signatures',
  LAST_UPDATE: 'updates:lastChange',
}

// TTL values in seconds
const TTL = {
  WITHDRAWAL_BUCKET: 5 * 60, // 5 minutes
  ALERTS: 24 * 60 * 60, // 24 hours
  PROCESSED_SIGNATURES: 60 * 60, // 1 hour
}

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      throw new Error('Upstash Redis environment variables are required')
    }

    redisClient = new Redis({ url, token })
  }

  return redisClient
}

/**
 * Trigger update notification for real-time frontend updates
 */
export async function triggerUpdate(): Promise<void> {
  const redis = getRedisClient()
  await redis.set(KEYS.LAST_UPDATE, Date.now())
}

/**
 * Get the bucket key for a destination wallet at a specific time window
 * Buckets are 5-minute windows
 */
function getBucketKey(destinationWallet: string, timestamp: number): string {
  const windowStart = Math.floor(timestamp / (5 * 60)) * (5 * 60)
  return `${KEYS.WITHDRAWAL_BUCKET}:${destinationWallet}:${windowStart}`
}

/**
 * Add a withdrawal to the appropriate time bucket for its destination
 */
export async function addWithdrawalToBucket(
  withdrawal: StakeWithdrawal
): Promise<void> {
  const redis = getRedisClient()
  const bucketKey = getBucketKey(withdrawal.destinationWallet, withdrawal.timestamp)

  // Store withdrawal in a hash keyed by source wallet
  // This automatically deduplicates by source
  await redis.hset(bucketKey, {
    [withdrawal.sourceWallet]: JSON.stringify(withdrawal),
  })

  // Set TTL on the bucket
  await redis.expire(bucketKey, TTL.WITHDRAWAL_BUCKET)
}

/**
 * Get all withdrawals in the current bucket for a destination
 */
export async function getWithdrawalsInBucket(
  destinationWallet: string,
  timestamp: number
): Promise<Map<string, StakeWithdrawal>> {
  const redis = getRedisClient()
  const bucketKey = getBucketKey(destinationWallet, timestamp)

  const data = await redis.hgetall<Record<string, string>>(bucketKey)
  const withdrawals = new Map<string, StakeWithdrawal>()

  if (data) {
    for (const [sourceWallet, value] of Object.entries(data)) {
      try {
        // Upstash may return parsed objects or strings
        const withdrawal = typeof value === 'string'
          ? JSON.parse(value) as StakeWithdrawal
          : value as StakeWithdrawal
        withdrawals.set(sourceWallet, withdrawal)
      } catch (e) {
        console.error('Failed to parse withdrawal:', e)
      }
    }
  }

  return withdrawals
}

/**
 * Save or update a suspicious pattern alert
 * Uses destination wallet as the ID so we only have one alert per destination
 */
export async function saveAlert(pattern: SuspiciousPattern): Promise<void> {
  const redis = getRedisClient()

  // Use destination wallet as the alert ID
  const alertId = pattern.destinationWallet

  // Store the alert (overwrite if exists)
  await redis.set(`${KEYS.ALERTS}:${alertId}`, JSON.stringify({
    ...pattern,
    id: alertId,
  }), {
    ex: TTL.ALERTS,
  })

  // Add/update in sorted set by detection time
  await redis.zadd(KEYS.ALERTS_LIST, {
    score: pattern.detectedAt,
    member: alertId,
  })

  // Trim old alerts from list (keep last 1000)
  await redis.zremrangebyrank(KEYS.ALERTS_LIST, 0, -1001)

  // Trigger real-time update
  await triggerUpdate()
}

/**
 * Get existing alert for a destination wallet
 */
export async function getAlertByDestination(destinationWallet: string): Promise<SuspiciousPattern | null> {
  const redis = getRedisClient()
  const data = await redis.get<string>(`${KEYS.ALERTS}:${destinationWallet}`)

  if (data) {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data
    } catch (e) {
      return null
    }
  }
  return null
}

/**
 * Get recent alerts
 */
export async function getAlerts(limit = 50): Promise<SuspiciousPattern[]> {
  const redis = getRedisClient()

  // Get alert IDs sorted by detection time (newest first)
  const alertIds = await redis.zrange(KEYS.ALERTS_LIST, -limit, -1)

  if (!alertIds || alertIds.length === 0) {
    return []
  }

  // Fetch all alerts in parallel
  const alertPromises = alertIds.map(async (id) => {
    const data = await redis.get<string>(`${KEYS.ALERTS}:${id}`)
    if (data) {
      try {
        return typeof data === 'string' ? JSON.parse(data) : data
      } catch (e) {
        return null
      }
    }
    return null
  })

  const alerts = await Promise.all(alertPromises)
  return alerts.filter((a): a is SuspiciousPattern => a !== null).reverse()
}

/**
 * Get a specific alert by ID
 */
export async function getAlert(id: string): Promise<SuspiciousPattern | null> {
  const redis = getRedisClient()
  const data = await redis.get<string>(`${KEYS.ALERTS}:${id}`)

  if (data) {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data
    } catch (e) {
      return null
    }
  }
  return null
}

/**
 * Update stats after polling
 */
export async function updateStats(
  transactionsScanned: number,
  pollTime: number
): Promise<void> {
  const redis = getRedisClient()

  await redis.set(KEYS.LAST_POLL, pollTime)
  await redis.incrby(KEYS.TRANSACTIONS_SCANNED, transactionsScanned)

  // Trigger real-time update
  await triggerUpdate()
}

/**
 * Get dashboard statistics
 */
export async function getStats(): Promise<DashboardStats> {
  const redis = getRedisClient()

  // Get last poll time and total transactions scanned
  const [lastPollTime, transactionsScanned] = await Promise.all([
    redis.get<number>(KEYS.LAST_POLL),
    redis.get<number>(KEYS.TRANSACTIONS_SCANNED),
  ])

  // Get alerts from today
  const todayStart = Math.floor(Date.now() / 1000) - 24 * 60 * 60
  const alertIds = await redis.zrange(KEYS.ALERTS_LIST, todayStart, '+inf', { byScore: true })

  // Fetch alerts to calculate severity breakdown
  const alerts: SuspiciousPattern[] = []
  if (alertIds && alertIds.length > 0) {
    for (const id of alertIds) {
      const data = await redis.get<string>(`${KEYS.ALERTS}:${id}`)
      if (data) {
        try {
          const alert = typeof data === 'string' ? JSON.parse(data) : data
          alerts.push(alert)
        } catch (e) {
          // Skip malformed
        }
      }
    }
  }

  const alertsBySeverity = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }

  for (const alert of alerts) {
    alertsBySeverity[alert.severity]++
  }

  return {
    totalAlertsToday: alerts.length,
    criticalCount: alertsBySeverity.critical,
    transactionsScanned: transactionsScanned || 0,
    lastPollTime: lastPollTime || null,
    alertsBySeverity,
  }
}

/**
 * Check if a signature has already been processed
 */
export async function isSignatureProcessed(signature: string): Promise<boolean> {
  const redis = getRedisClient()
  const result = await redis.sismember(KEYS.PROCESSED_SIGNATURES, signature)
  return result === 1
}

/**
 * Batch check which signatures have been processed
 * Returns a Set of signatures that are already processed
 */
export async function getProcessedSignatures(signatures: string[]): Promise<Set<string>> {
  if (signatures.length === 0) return new Set()

  const redis = getRedisClient()
  const processed = new Set<string>()

  // Use smismember for batch checking (single Redis call)
  const results = await redis.smismember(KEYS.PROCESSED_SIGNATURES, signatures)

  for (let i = 0; i < signatures.length; i++) {
    if (results[i] === 1) {
      processed.add(signatures[i])
    }
  }

  return processed
}

/**
 * Mark signatures as processed
 */
export async function markSignaturesProcessed(signatures: string[]): Promise<void> {
  if (signatures.length === 0) return

  const redis = getRedisClient()
  await redis.sadd(KEYS.PROCESSED_SIGNATURES, signatures)
  // Set TTL on the set (refresh on each add)
  await redis.expire(KEYS.PROCESSED_SIGNATURES, TTL.PROCESSED_SIGNATURES)
}

/**
 * Clear alerts data
 */
export async function clearAll(): Promise<void> {
  const redis = getRedisClient()

  // Get all alert IDs and delete them
  const alertIds = await redis.zrange(KEYS.ALERTS_LIST, 0, -1)

  // Delete alert list
  await redis.del(KEYS.ALERTS_LIST)

  // Delete individual alerts
  if (alertIds && alertIds.length > 0) {
    const alertKeys = alertIds.map(id => `${KEYS.ALERTS}:${id}`)
    for (const key of alertKeys) {
      await redis.del(key)
    }
  }

  // Clear processed signatures
  await redis.del(KEYS.PROCESSED_SIGNATURES)

  // Trigger update
  await triggerUpdate()
}
