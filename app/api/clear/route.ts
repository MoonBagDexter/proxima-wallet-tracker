import { NextResponse } from 'next/server'
import { clearAll } from '@/lib/storage/redis'

export const runtime = 'edge'

export async function POST(request: Request) {
  // Simple auth check - require a secret key
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CLEAR_SECRET || 'clear-alerts-now'

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await clearAll()
    return NextResponse.json({ success: true, message: 'All data cleared' })
  } catch (error) {
    console.error('Failed to clear data:', error)
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}
