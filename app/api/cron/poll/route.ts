import { NextRequest, NextResponse } from 'next/server'
import { createHeliusClient } from '@/lib/helius/client'
import { parseStakeWithdrawals } from '@/lib/helius/stake-parser'
import { processWithdrawals } from '@/lib/detection/engine'
import { updateStats } from '@/lib/storage/redis'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * Cron job endpoint that polls for new stake withdrawals
 * Called every minute by Vercel Cron
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (if configured)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startTime = Date.now()

  try {
    // Create Helius client
    const helius = createHeliusClient()

    // Fetch recent stake withdrawals
    console.log('Fetching stake withdrawals from Helius...')
    const transactions = await helius.getStakeWithdrawals({ limit: 100 })

    // Parse transactions to extract stake withdrawals
    const withdrawals = parseStakeWithdrawals(transactions)
    console.log(`Parsed ${withdrawals.length} stake withdrawals from ${transactions.length} transactions`)

    // Process withdrawals through detection engine
    const detectedPatterns = await processWithdrawals(withdrawals)
    console.log(`Detected ${detectedPatterns.length} suspicious patterns`)

    // Update stats
    const pollTime = Math.floor(Date.now() / 1000)
    await updateStats(transactions.length, pollTime)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      transactionsFetched: transactions.length,
      withdrawalsParsed: withdrawals.length,
      patternsDetected: detectedPatterns.length,
      patterns: detectedPatterns.map((p) => ({
        id: p.id,
        destination: p.destinationWallet,
        sourceCount: p.sourceWallets.length,
        severity: p.severity,
        totalSol: p.totalAmountSol,
      })),
      durationMs: duration,
    })
  } catch (error) {
    console.error('Poll error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
