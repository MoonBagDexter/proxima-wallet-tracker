import { NextRequest } from 'next/server'
import { getLastUpdate } from '@/lib/storage/json-storage'

export const dynamic = 'force-dynamic'

/**
 * SSE endpoint for real-time updates
 * GET /api/updates - Subscribe to updates stream
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastSeen = 0

      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send initial connection event
      sendEvent({ type: 'connected', timestamp: Date.now() })

      // Poll for changes every 2 seconds
      const interval = setInterval(async () => {
        try {
          const lastUpdate = await getLastUpdate()

          if (lastUpdate > lastSeen) {
            lastSeen = lastUpdate
            sendEvent({ type: 'update', timestamp: lastUpdate })
          }
        } catch (e) {
          console.error('SSE poll error:', e)
        }
      }, 2000)

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
