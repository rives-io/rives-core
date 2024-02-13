import { init } from '@web3-onboard/react'
import injectedModule from '@web3-onboard/injected-wallets'
import { envClient } from './clientEnv'


const chain = {
  id: envClient.NETWORK_CHAIN_ID
}


const chains = [chain]

const wallets = [injectedModule()]

const appMetadata = {
  name: 'RiVES',
  icon: '<svg>My App Icon</svg>',
  description: 'RiVES allows users to play riscv-binaries of games on a RISC-V Cartesi Machine on the browser. The game moves are submited onchain so the session can be replayed in a Cartesi Rollups DApp to generate a provable score.',
  recommendedInjectedWallets: [
    { name: 'MetaMask', url: 'https://metamask.io' },
    { name: 'Coinbase', url: 'https://wallet.coinbase.com/' }
  ]
}

// initialize and export Onboard
const web3Onboard = init({
  wallets,
  chains,
  appMetadata,
  connect: {
    autoConnectLastWallet: true
  },
  accountCenter: {desktop: {enabled: false}, mobile: {enabled: false}}
})

export default web3Onboard;