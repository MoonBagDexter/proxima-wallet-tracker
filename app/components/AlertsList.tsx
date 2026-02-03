'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCard } from './AlertCard'
import type { SuspiciousPattern, Severity } from '@/types/alert'
import type { StakeWithdrawal } from '@/types/transaction'

interface AlertsResponse {
  alerts: SuspiciousPattern[]
  count: number
}

export interface GroupedAlert {
  destinationWallet: string
  sourceWallets: string[]
  transactions: StakeWithdrawal[]
  totalAmountSol: number
  windowStart: number
  windowEnd: number
  severity: Severity
  latestDetectedAt: number
}

async function fetchAlerts(): Promise<AlertsResponse> {
  const response = await fetch('/api/alerts')
  if (!response.ok) throw new Error('Failed to fetch alerts')
  return response.json()
}

function groupAlertsByDestination(alerts: SuspiciousPattern[]): GroupedAlert[] {
  const grouped = new Map<string, GroupedAlert>()

  for (const alert of alerts) {
    const existing = grouped.get(alert.destinationWallet)

    if (existing) {
      // Merge source wallets (dedupe)
      const sourceSet = new Set([...existing.sourceWallets, ...alert.sourceWallets])
      existing.sourceWallets = Array.from(sourceSet)

      // Merge transactions (dedupe by signature)
      const txMap = new Map(existing.transactions.map((tx) => [tx.signature, tx]))
      for (const tx of alert.transactions) {
        if (!txMap.has(tx.signature)) {
          txMap.set(tx.signature, tx)
        }
      }
      existing.transactions = Array.from(txMap.values())

      // Update totals
      existing.totalAmountSol = existing.transactions.reduce((sum, tx) => sum + tx.amountSol, 0)
      existing.windowStart = Math.min(existing.windowStart, alert.windowStart)
      existing.windowEnd = Math.max(existing.windowEnd, alert.windowEnd)
      existing.latestDetectedAt = Math.max(existing.latestDetectedAt, alert.detectedAt)

      // Use highest severity
      const severityOrder: Severity[] = ['low', 'medium', 'high', 'critical']
      if (severityOrder.indexOf(alert.severity) > severityOrder.indexOf(existing.severity)) {
        existing.severity = alert.severity
      }
    } else {
      grouped.set(alert.destinationWallet, {
        destinationWallet: alert.destinationWallet,
        sourceWallets: [...alert.sourceWallets],
        transactions: [...alert.transactions],
        totalAmountSol: alert.totalAmountSol,
        windowStart: alert.windowStart,
        windowEnd: alert.windowEnd,
        severity: alert.severity,
        latestDetectedAt: alert.detectedAt,
      })
    }
  }

  // Sort by latest detection time (newest first)
  return Array.from(grouped.values()).sort((a, b) => b.latestDetectedAt - a.latestDetectedAt)
}

export function AlertsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  })

  const groupedAlerts = useMemo(() => {
    if (!data?.alerts) return []
    return groupAlertsByDestination(data.alerts)
  }, [data?.alerts])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 animate-pulse"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-16 bg-zinc-800 rounded-full" />
              <div className="h-4 w-20 bg-zinc-800 rounded" />
            </div>
            <div className="h-5 w-48 bg-zinc-800 rounded mb-2" />
            <div className="h-4 w-32 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-400">
        Failed to load alerts: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }

  if (!data || groupedAlerts.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <div className="text-4xl mb-3">
          <span role="img" aria-label="shield">&#128737;</span>
        </div>
        <h3 className="text-lg font-medium text-white mb-1">No Alerts Detected</h3>
        <p className="text-sm text-zinc-400">
          The system is monitoring for suspicious stake withdrawal patterns.
          <br />
          Alerts will appear here when detected.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groupedAlerts.map((alert) => (
        <AlertCard key={alert.destinationWallet} alert={alert} />
      ))}
    </div>
  )
}
