import type { StakeWithdrawal } from './transaction'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface SuspiciousPattern {
  id: string
  destinationWallet: string
  sourceWallets: string[]
  transactions: StakeWithdrawal[]
  totalAmountSol: number
  windowStart: number
  windowEnd: number
  severity: Severity
  detectedAt: number
}

export interface DashboardStats {
  totalAlertsToday: number
  criticalCount: number
  transactionsScanned: number
  lastPollTime: number | null
  alertsBySeverity: {
    low: number
    medium: number
    high: number
    critical: number
  }
}
