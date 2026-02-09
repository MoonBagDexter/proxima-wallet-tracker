import { NextResponse } from 'next/server'
import { clearAll } from '@/lib/storage/json-storage'

export const dynamic = 'force-dynamic'

/**
 * Clear all alerts and start fresh
 * POST /api/clear
 */
export async function POST() {
  try {
    await clearAll()
    return NextResponse.json({ success: true, message: 'All data cleared' })
  } catch (error) {
    console.error('Clear error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
