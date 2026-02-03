'use client'

import { StatsCards } from './components/StatsCards'
import { AlertsList } from './components/AlertsList'
import { RefreshIndicator } from './components/RefreshIndicator'
import { useRealTimeUpdates } from './hooks/useRealTimeUpdates'

export default function Dashboard() {
  // Subscribe to real-time updates
  useRealTimeUpdates()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                Proxima Wallet Tracker
              </h1>
              <p className="text-sm text-zinc-400">
                Monitoring Solana stake withdrawal consolidations
              </p>
            </div>
            <RefreshIndicator />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats Section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Overview
          </h2>
          <StatsCards />
        </section>

        {/* Alerts Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Recent Alerts
            </h2>
          </div>
          <AlertsList />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <p className="text-xs text-zinc-500 text-center">
            Detection criteria: 3+ unique wallets consolidating to same destination within 5 minutes
          </p>
        </div>
      </footer>
    </div>
  )
}
