'use client'

import { useQuery } from '@tanstack/react-query'
import { cn, timeAgo } from '@/lib/utils'
import type { DashboardStats } from '@/types/alert'

async function fetchStats(): Promise<DashboardStats> {
  const response = await fetch('/api/stats')
  if (!response.ok) throw new Error('Failed to fetch stats')
  return response.json()
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  variant?: 'default' | 'critical' | 'warning' | 'success'
}

function StatCard({ title, value, subtitle, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        variant === 'default' && 'border-zinc-800 bg-zinc-900',
        variant === 'critical' && 'border-red-900 bg-red-950/50',
        variant === 'warning' && 'border-yellow-900 bg-yellow-950/50',
        variant === 'success' && 'border-green-900 bg-green-950/50'
      )}
    >
      <p className="text-sm text-zinc-400">{title}</p>
      <p
        className={cn(
          'text-2xl font-bold mt-1',
          variant === 'default' && 'text-white',
          variant === 'critical' && 'text-red-400',
          variant === 'warning' && 'text-yellow-400',
          variant === 'success' && 'text-green-400'
        )}
      >
        {value}
      </p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </div>
  )
}

export function StatsCards() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 animate-pulse"
          >
            <div className="h-4 bg-zinc-800 rounded w-24 mb-2" />
            <div className="h-8 bg-zinc-800 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-400">
        Failed to load stats
      </div>
    )
  }

  const lastPollText = stats.lastPollTime
    ? timeAgo(stats.lastPollTime)
    : 'Never'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        title="Alerts Today"
        value={stats.totalAlertsToday}
        subtitle={`${stats.alertsBySeverity.high + stats.alertsBySeverity.critical} high priority`}
        variant={stats.totalAlertsToday > 0 ? 'warning' : 'default'}
      />
      <StatCard
        title="Critical Alerts"
        value={stats.criticalCount}
        subtitle="Requires immediate attention"
        variant={stats.criticalCount > 0 ? 'critical' : 'default'}
      />
      <StatCard
        title="Transactions Scanned"
        value={stats.transactionsScanned.toLocaleString()}
        subtitle="All time"
      />
      <StatCard
        title="Last Poll"
        value={lastPollText}
        subtitle={
          stats.lastPollTime
            ? new Date(stats.lastPollTime * 1000).toLocaleTimeString()
            : 'System not polling'
        }
        variant={
          stats.lastPollTime && Date.now() / 1000 - stats.lastPollTime < 120
            ? 'success'
            : 'warning'
        }
      />
    </div>
  )
}
