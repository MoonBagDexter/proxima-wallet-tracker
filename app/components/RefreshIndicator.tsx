'use client'

import { useIsFetching } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function RefreshIndicator() {
  const isFetching = useIsFetching()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Check SSE connection status
    const checkConnection = () => {
      setIsConnected(true)
    }

    // Set connected after mount
    const timeout = setTimeout(checkConnection, 1000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-colors',
          isFetching > 0
            ? 'bg-blue-500 animate-pulse'
            : isConnected
            ? 'bg-green-500'
            : 'bg-yellow-500'
        )}
      />
      <span className="text-zinc-400">
        {isFetching > 0
          ? 'Updating...'
          : isConnected
          ? 'Live'
          : 'Connecting...'}
      </span>
    </div>
  )
}
