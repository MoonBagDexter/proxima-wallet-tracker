import { NextRequest, NextResponse } from 'next/server'
import { parseStakeWithdrawals } from '@/lib/helius/stake-parser'
import { processWithdrawals } from '@/lib/detection/engine'
import { updateStats } from '@/lib/storage/redis'
import type { HeliusEnhancedTransaction } from '@/types/transaction'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * Webhook endpoint to receive real-time stake withdrawal notifications from Helius
 * POST /api/webhook/helius
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Helius sends an array of transactions
    const transactions: HeliusEnhancedTransaction[] = Array.isArray(body) ? body : [body]

    console.log(`Received ${transactions.length} transactions from Helius webhook`)

    // Filter for stake-related transactions
    const stakeTransactions = transactions.filter(tx =>
      tx.type === 'WITHDRAW' ||
      tx.type === 'STAKE_WITHDRAW' ||
      tx.type === 'WITHDRAW_STAKE' ||
      tx.source === 'STAKE_PROGRAM' ||
      tx.type?.includes('STAKE')
    )

    console.log(`Found ${stakeTransactions.length} stake-related transactions`)

    if (stakeTransactions.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    // Parse withdrawals
    const withdrawals = parseStakeWithdrawals(stakeTransactions)
    console.log(`Parsed ${withdrawals.length} stake withdrawals`)

    // Process through detection engine
    const detectedPatterns = await processWithdrawals(withdrawals)
    console.log(`Detected ${detectedPatterns.length} suspicious patterns`)

    // Update stats
    const pollTime = Math.floor(Date.now() / 1000)
    await updateStats(stakeTransactions.length, pollTime)

    return NextResponse.json({
      success: true,
      processed: stakeTransactions.length,
      withdrawals: withdrawals.length,
      patternsDetected: detectedPatterns.length,
    })
  } catch (error) {
    console.error('Webhook error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also handle GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'Helius webhook endpoint active' })
}
