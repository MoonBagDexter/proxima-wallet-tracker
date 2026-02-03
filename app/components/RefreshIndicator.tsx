'use client'

import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function RefreshIndicator() {
  const isFetching = useIsFetching()
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(true)
    }
    const timeout = setTimeout(checkConnection, 1000)
    return () => clearTimeout(timeout)
  }, [])

  const handleRefresh = async () => {
    if (isPolling) return
    setIsPolling(true)

    try {
      // Trigger the poll endpoint to fetch latest data from Helius
      await fetch('/api/cron/poll', { method: 'GET' })
      // Refresh the queries to show new data
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
    } catch (error) {
      console.error('Poll failed:', error)
    } finally {
      setIsPolling(false)
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        onClick={handleRefresh}
        disabled={isPolling || isFetching > 0}
        className={cn(
          'px-3 py-1.5 rounded-md font-medium transition-colors',
          isPolling || isFetching > 0
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-zinc-800 text-white hover:bg-zinc-700'
        )}
      >
        {isPolling ? 'Polling...' : 'Refresh'}
      </button>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            isFetching > 0 || isPolling
              ? 'bg-blue-500 animate-pulse'
              : isConnected
              ? 'bg-green-500'
              : 'bg-yellow-500'
          )}
        />
        <span className="text-zinc-400">
          {isFetching > 0 || isPolling
            ? 'Updating...'
            : isConnected
            ? 'Live'
            : 'Connecting...'}
        </span>
      </div>
    </div>
  )
}
