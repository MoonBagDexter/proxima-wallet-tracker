export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const POLL_INTERVAL_MS = 60_000

    const poll = async () => {
      try {
        const { createHeliusClient } = await import('@/lib/helius/client')
        const { parseStakeWithdrawals } = await import('@/lib/helius/stake-parser')
        const { processWithdrawals } = await import('@/lib/detection/engine')
        const { updateStats } = await import('@/lib/storage/json-storage')

        const startTime = Date.now()
        const helius = createHeliusClient()

        const transactions = await helius.getStakeWithdrawals({ limit: 100 })
        const withdrawals = parseStakeWithdrawals(transactions)
        const detectedPatterns = await processWithdrawals(withdrawals)

        const pollTime = Math.floor(Date.now() / 1000)
        await updateStats(transactions.length, pollTime)

        const duration = Date.now() - startTime
        console.log(
          `[poll] ${transactions.length} txs, ${withdrawals.length} withdrawals, ${detectedPatterns.length} patterns (${duration}ms)`
        )
      } catch (error) {
        console.error('[poll] error:', error)
      }
    }

    // Wait a few seconds for the server to fully start, then begin polling
    setTimeout(() => {
      console.log('[poll] Background polling started (every 60s)')
      poll() // Initial poll
      setInterval(poll, POLL_INTERVAL_MS)
    }, 5_000)
  }
}
