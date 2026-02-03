'use client'

import { useState } from 'react'
import { cn, formatAddress, formatTimestamp, timeAgo } from '@/lib/utils'
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
  const [isExpanded, setIsExpanded] = useState(true)
  const styles = SEVERITY_STYLES[alert.severity]

  const solscanWalletUrl = (address: string) =>
    `https://solscan.io/account/${address}`
  const solscanTxUrl = (signature: string) =>
    `https://solscan.io/tx/${signature}`

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        styles.border,
        styles.bg
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full border',
                styles.badge
              )}
            >
              {alert.severity.toUpperCase()}
            </span>
            <span className="text-xs text-zinc-500">
              {timeAgo(alert.detectedAt)}
            </span>
          </div>

          <h3 className="font-mono text-sm">
            <a
              href={solscanWalletUrl(alert.destinationWallet)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-blue-400 transition-colors"
            >
              {formatAddress(alert.destinationWallet, 8)}
            </a>
          </h3>

          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-zinc-400">
              <span className="font-semibold text-white">
                {alert.sourceWallets.length}
              </span>{' '}
              source wallets
            </span>
            <span className="text-zinc-400">
              <span className="font-semibold text-white">
                {alert.totalAmountSol.toFixed(2)}
              </span>{' '}
              SOL total
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-400 hover:text-white transition-colors text-sm"
        >
          {isExpanded ? 'Hide' : 'Show'} details
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-1">Time Window</p>
            <p className="text-sm text-zinc-300">
              {formatTimestamp(alert.windowStart)} -{' '}
              {formatTimestamp(alert.windowEnd)}
            </p>
          </div>

          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2">Source Wallets</p>
            <div className="flex flex-wrap gap-2">
              {alert.sourceWallets.map((wallet) => (
                <a
                  key={wallet}
                  href={solscanWalletUrl(wallet)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs px-2 py-1 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
                >
                  {formatAddress(wallet, 4)}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-2">Transactions</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alert.transactions.map((tx) => (
                <div
                  key={tx.signature}
                  className="flex items-center justify-between text-xs bg-zinc-800/50 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <a
                      href={solscanTxUrl(tx.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-400 hover:text-blue-300"
                    >
                      {formatAddress(tx.signature, 4)}
                    </a>
                    <span className="text-zinc-500">from</span>
                    <span className="font-mono text-zinc-300">
                      {formatAddress(tx.sourceWallet, 4)}
                    </span>
                  </div>
                  <span className="text-zinc-300 font-medium">
                    {tx.amountSol.toFixed(4)} SOL
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
