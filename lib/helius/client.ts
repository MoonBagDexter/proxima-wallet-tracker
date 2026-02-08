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
   * Fetch recent stake withdrawal transactions from the Stake Program.
   * Uses Solana RPC to get recent signatures, then Helius to parse them.
   */
  async getStakeWithdrawals(options: {
    limit?: number
  } = {}): Promise<HeliusEnhancedTransaction[]> {
    const { limit = 100 } = options
    const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111'
    const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'

    try {
      // Get recent signatures from the Stake Program via Solana RPC
      const rpcResponse = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [STAKE_PROGRAM_ID, { limit: Math.min(limit * 3, 300) }],
        }),
      })

      const rpcData = await rpcResponse.json() as {
        result: Array<{ signature: string }>
      }

      if (!rpcData.result?.length) return []

      const signatures = rpcData.result.map((s) => s.signature)

      // Parse through Helius in batches of 100
      const allTransactions: HeliusEnhancedTransaction[] = []
      for (let i = 0; i < signatures.length; i += 100) {
        const batch = signatures.slice(i, i + 100)
        const parsed = await this.parseTransactions(batch)
        allTransactions.push(...parsed)
      }

      // Filter for stake withdrawals
      const withdrawals = allTransactions.filter(
        (tx) => tx.type === 'WITHDRAW' && tx.source === 'STAKE_PROGRAM'
      )

      return withdrawals.slice(0, limit)
    } catch (e) {
      console.error('Failed to fetch stake withdrawals:', e)
      return []
    }
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
