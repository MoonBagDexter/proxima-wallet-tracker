import type { HeliusEnhancedTransaction, StakeWithdrawal } from '@/types/transaction'

/**
 * Parse Helius enhanced transactions to extract stake withdrawals
 */
export function parseStakeWithdrawals(
  transactions: HeliusEnhancedTransaction[]
): StakeWithdrawal[] {
  const withdrawals: StakeWithdrawal[] = []

  for (const tx of transactions) {
    const withdrawal = extractWithdrawal(tx)
    if (withdrawal) {
      withdrawals.push(withdrawal)
    }
  }

  return withdrawals
}

/**
 * Extract withdrawal details from a transaction
 */
function extractWithdrawal(tx: HeliusEnhancedTransaction): StakeWithdrawal | null {
  // Method 1: Use accountData to find the actual recipient (most accurate)
  const accountChanges = tx.accountData || []

  // Find account with positive balance change (recipient)
  const recipient = accountChanges.find(a =>
    a.nativeBalanceChange > 0 &&
    a.account !== '11111111111111111111111111111111' // Not system program
  )

  if (recipient && recipient.nativeBalanceChange > 10_000_000) { // > 0.01 SOL
    // Find the account that directly sent SOL to the destination (largest negative change = stake account)
    const source = accountChanges
      .filter(a => a.nativeBalanceChange < 0 && a.account !== '11111111111111111111111111111111')
      .sort((a, b) => a.nativeBalanceChange - b.nativeBalanceChange)[0] // most negative first

    if (!source) return null

    const sourceWallet = source.account
    const destinationWallet = recipient.account

    // Skip if same wallet
    if (sourceWallet === destinationWallet) {
      return null
    }

    return {
      signature: tx.signature,
      timestamp: tx.timestamp,
      sourceWallet,
      destinationWallet,
      amountSol: recipient.nativeBalanceChange / 1_000_000_000,
    }
  }

  // Method 2: Fall back to nativeTransfers
  const nativeTransfers = tx.nativeTransfers || []
  if (nativeTransfers.length === 0) {
    return null
  }

  // Find the largest transfer
  let largestTransfer = nativeTransfers[0]
  for (const transfer of nativeTransfers) {
    if (transfer.amount > largestTransfer.amount) {
      largestTransfer = transfer
    }
  }

  // Skip tiny transfers
  if (largestTransfer.amount < 10_000_000) {
    return null
  }

  const sourceWallet = tx.feePayer || largestTransfer.fromUserAccount
  const destinationWallet = largestTransfer.toUserAccount

  if (!sourceWallet || !destinationWallet || sourceWallet === destinationWallet) {
    return null
  }

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    sourceWallet,
    destinationWallet,
    amountSol: largestTransfer.amount / 1_000_000_000,
  }
}

/**
 * Filter stake withdrawals to only include those within a time window
 */
export function filterByTimeWindow(
  withdrawals: StakeWithdrawal[],
  startTimestamp: number,
  endTimestamp: number
): StakeWithdrawal[] {
  return withdrawals.filter(
    (w) => w.timestamp >= startTimestamp && w.timestamp <= endTimestamp
  )
}
