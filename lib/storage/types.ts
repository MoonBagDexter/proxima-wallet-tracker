import type { SuspiciousPattern } from '@/types/alert'
import type { StakeWithdrawal } from '@/types/transaction'

// TTL values in milliseconds
export const TTL = {
  WITHDRAWAL_BUCKET: 5 * 60 * 1000, // 5 minutes
  ALERTS: 24 * 60 * 60 * 1000, // 24 hours
  PROCESSED_SIGNATURES: 24 * 60 * 60 * 1000, // 24 hours
}

export interface AlertEntry {
  data: SuspiciousPattern
  expiresAt: number
}

export interface WithdrawalBucket {
  data: Record<string, StakeWithdrawal>
  expiresAt: number
}

export interface StorageSchema {
  version: 1
  alerts: Record<string, AlertEntry>
  alertsList: Array<{ id: string; score: number }>
  withdrawalBuckets: Record<string, WithdrawalBucket>
  processedSignatures: string[]
  processedSignaturesExpiresAt: number
  stats: {
    lastPoll: number | null
    txScanned: number
  }
  lastUpdate: number
}
