'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useRealTimeUpdates() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let eventSource: EventSource | null = null

    const connect = () => {
      eventSource = new EventSource('/api/updates')

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'update') {
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            queryClient.invalidateQueries({ queryKey: ['stats'] })
          }
        } catch (e) {
          console.error('SSE parse error:', e)
        }
      }

      eventSource.onerror = () => {
        // Reconnect after 5 seconds on error
        eventSource?.close()
        setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      eventSource?.close()
    }
  }, [queryClient])
}
