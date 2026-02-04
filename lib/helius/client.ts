import type { HeliusEnhancedTransaction } from '@/types/transaction'

const HELIUS_BASE_URL = 'https://api.helius.xyz/v0'

export class HeliusClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Fetch recent transactions for a given address using Helius Enhanced API
   */
  async getTransactions(
    address: string,
    options: {
      limit?: number
      before?: string
      type?: string
    } = {}
  ): Promise<HeliusEnhancedTransaction[]> {
    const { limit = 100, before, type } = options

    const params = new URLSearchParams({
      'api-key': this.apiKey,
      limit: String(limit),
    })

    if (before) params.append('before', before)
    if (type) params.append('type', type)

    const url = `${HELIUS_BASE_URL}/addresses/${address}/transactions?${params}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Fetch stake withdrawal transactions using Helius enhanced transactions API
   * Queries known large staking pools and validators for recent activity
   */
  async getStakeWithdrawals(options: {
    limit?: number
  } = {}): Promise<HeliusEnhancedTransaction[]> {
    const { limit = 100 } = options

    // Known large Solana staking pools and validators
    const stakingPools = [
      'mpa4abUkjQoAvPzREkh5Mo75hZhPFQ2FSH6w7dWKuQ5', // Marinade Finance
      'CgntPoLka5pD5fesJYhGmUCF8KU1QS1ZmZiuAuMZr2az', // Cogent Crypto
      'J1to1yufRnoWn81KYg1XkTWzmKjnYSnmE2VY8DGUJ9Qv', // Jito
      'stWirqFCf2Uts1JBL1Jsd3r6VBWhgnpdPxCTe1MFjrq', // Staked
    ]

    const allTransactions: HeliusEnhancedTransaction[] = []

    // Fetch transactions from each staking pool
    for (const pool of stakingPools) {
      try {
        const transactions = await this.getTransactions(pool, { limit: Math.ceil(limit / stakingPools.length) })

        // Filter for stake-related transactions only (no TRANSFER)
        const stakeTransactions = transactions.filter(tx =>
          tx.type?.includes('STAKE') ||
          this.hasStakeProgramInteraction(tx)
        )

        allTransactions.push(...stakeTransactions)
      } catch (e) {
        console.error(`Failed to fetch from ${pool}:`, e)
        // Continue with other pools
      }
    }

    return allTransactions.slice(0, limit)
  }

  /**
   * Check if a transaction interacts with the stake program
   */
  private hasStakeProgramInteraction(tx: HeliusEnhancedTransaction): boolean {
    const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111'

    if (!tx.instructions) return false

    return tx.instructions.some(ix =>
      ix.programId === STAKE_PROGRAM_ID ||
      ix.innerInstructions?.some(inner => inner.programId === STAKE_PROGRAM_ID)
    )
  }

  /**
   * Parse multiple transactions by their signatures
   */
  async parseTransactions(signatures: string[]): Promise<HeliusEnhancedTransaction[]> {
    if (signatures.length === 0) return []

    const url = `${HELIUS_BASE_URL}/transactions?api-key=${this.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: signatures,
      }),
    })

    if (!response.ok) {
      throw new Error(`Helius parse error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}

export function createHeliusClient(): HeliusClient {
  const apiKey = process.env.HELIUS_API_KEY
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY environment variable is required')
  }
  return new HeliusClient(apiKey)
}
