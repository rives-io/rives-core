import { init } from '@web3-onboard/react'
import injectedModule from '@web3-onboard/injected-wallets'

const INFURA_KEY = ''

const ethereumRopsten = {
  id: '0x3',
  token: 'rETH',
  label: 'Ethereum Ropsten',
  rpcUrl: `https://ropsten.infura.io/v3/${INFURA_KEY}`
}

const polygonMainnet = {
  id: '0x89',
  token: 'MATIC',
  label: 'Polygon',
  rpcUrl: 'https://matic-mainnet.chainstacklabs.com'
}

const chains = [ethereumRopsten, polygonMainnet]

const wallets = [injectedModule()]

const appMetadata = {
  name: 'World Arcade',
  icon: '<svg>My App Icon</svg>',
  description: 'The World Arcade allows users to play riscv-binaries of games on a RISC-V Cartesi Machine on the browser. The game moves are submited onchain so the session can be replayed in a Cartesi Rollups DApp to generate a provable score.',
  recommendedInjectedWallets: [
    { name: 'MetaMask', url: 'https://metamask.io' },
    { name: 'Coinbase', url: 'https://wallet.coinbase.com/' }
  ]
}

// initialize and export Onboard
const web3Onboard = init({
  wallets,
  chains,
  appMetadata
})

export default web3Onboard;