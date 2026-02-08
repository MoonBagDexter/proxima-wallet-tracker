import { NextRequest, NextResponse } from 'next/server'
import { getAlerts, getAlert } from '@/lib/storage/redis'

export const dynamic = 'force-dynamic'

/**
 * GET /api/alerts - Fetch recent alerts
 * GET /api/alerts?id=<id> - Fetch specific alert
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    if (id) {
      // Fetch specific alert
      const alert = await getAlert(id)

      if (!alert) {
        return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
      }

      return NextResponse.json(alert)
    }

    // Fetch all recent alerts
    const alerts = await getAlerts(limit)

    return NextResponse.json({
      alerts,
      count: alerts.length,
    })
  } catch (error) {
    console.error('Alerts API error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
