import { NextResponse } from 'next/server'
import { getStats } from '@/lib/storage/json-storage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats - Fetch dashboard statistics
 */
export async function GET() {
  try {
    const stats = await getStats()

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats API error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
