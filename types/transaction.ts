export interface StakeWithdrawal {
  signature: string
  timestamp: number
  sourceWallet: string
  destinationWallet: string
  amountSol: number
}

export interface HeliusEnhancedTransaction {
  signature: string
  timestamp: number
  type: string
  source: string
  fee: number
  feePayer: string
  nativeTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
  tokenTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    mint: string
    tokenAmount: number
  }>
  accountData?: Array<{
    account: string
    nativeBalanceChange: number
    tokenBalanceChanges: Array<{
      mint: string
      rawTokenAmount: {
        decimals: number
        tokenAmount: string
      }
    }>
  }>
  instructions?: Array<{
    programId: string
    accounts: string[]
    data: string
    innerInstructions?: Array<{
      programId: string
      accounts: string[]
      data: string
    }>
  }>
}

export interface HeliusTransactionResponse {
  result: HeliusEnhancedTransaction[]
  pagination?: {
    after?: string
  }
}
