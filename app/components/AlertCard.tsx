'use client'

import { useState } from 'react'
import { cn, formatAddress, timeAgo } from '@/lib/utils'
import type { SuspiciousPattern } from '@/types/alert'

interface AlertCardProps {
  alert: SuspiciousPattern
}

const SEVERITY_STYLES = {
  low: {
    badge: 'bg-blue-900/50 text-blue-400 border-blue-800',
    border: 'border-blue-900/50',
    bg: 'bg-blue-950/20',
  },
  medium: {
    badge: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    border: 'border-yellow-900/50',
    bg: 'bg-yellow-950/20',
  },
  high: {
    badge: 'bg-orange-900/50 text-orange-400 border-orange-800',
    border: 'border-orange-900/50',
    bg: 'bg-orange-950/20',
  },
  critical: {
    badge: 'bg-red-900/50 text-red-400 border-red-800',
    border: 'border-red-900/50',
    bg: 'bg-red-950/20',
  },
}

export function AlertCard({ alert }: AlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const styles = SEVERITY_STYLES[alert.severity]

  const solscanWallet = (addr: string) => `https://solscan.io/account/${addr}`
  const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`

  return (
    <div className={cn('rounded-lg border p-4', styles.border, styles.bg)}>
      {/* Header: severity + destination + summary */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', styles.badge)}>
              {alert.severity.toUpperCase()}
            </span>
            <span className="text-xs text-zinc-500">{timeAgo(alert.detectedAt)}</span>
          </div>

          {/* Destination wallet */}
          <p className="text-xs text-zinc-500 mb-0.5">Receiving wallet</p>
          <a
            href={solscanWallet(alert.destinationWallet)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-white hover:text-blue-400 transition-colors break-all"
          >
            {alert.destinationWallet}
          </a>

          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-zinc-400">
              <span className="font-semibold text-white">{alert.sourceWallets.length}</span> sources
            </span>
            <span className="text-zinc-400">
              <span className="font-semibold text-white">{alert.totalAmountSol.toFixed(2)}</span> SOL
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-400 hover:text-white transition-colors text-sm shrink-0"
        >
          {isExpanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Expanded: source wallets and their transfers */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
          {alert.transactions.map((tx) => (
            <div
              key={tx.signature}
              className="flex items-center justify-between text-sm bg-zinc-800/50 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <a
                  href={solscanWallet(tx.sourceWallet)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-zinc-300 hover:text-blue-400 transition-colors"
                >
                  {formatAddress(tx.sourceWallet, 6)}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">{tx.amountSol.toFixed(4)} SOL</span>
                <a
                  href={solscanTx(tx.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  tx
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
