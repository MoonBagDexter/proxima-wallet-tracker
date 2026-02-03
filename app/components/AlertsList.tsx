'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCard } from './AlertCard'
import type { SuspiciousPattern } from '@/types/alert'

interface AlertsResponse {
  alerts: SuspiciousPattern[]
  count: number
}

async function fetchAlerts(): Promise<AlertsResponse> {
  const response = await fetch('/api/alerts')
  if (!response.ok) throw new Error('Failed to fetch alerts')
  return response.json()
}

export function AlertsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  })

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

  if (!data || data.alerts.length === 0) {
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
      {data.alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  )
}
