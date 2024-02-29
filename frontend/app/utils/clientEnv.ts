import { str, envsafe, url } from 'envsafe';


export const envClient = envsafe({
  DAPP_ADDR: str({
    input: process.env.NEXT_PUBLIC_DAPP_ADDR,
    desc: "Cartesi DApp ETH address."
  }),
  CARTESI_NODE_URL: url({
    input: process.env.NEXT_PUBLIC_CARTESI_NODE_URL,
    desc: "Cartesi Node URL."
  }),
  NETWORK_CHAIN_ID: str({
    input: process.env.NEXT_PUBLIC_NETWORK_CHAIN_ID,
    desc: "Network ChainId (in hex) where the Cartesi DApp was deployed."
  }),
  NFT_ADDR: str({
    input: process.env.NEXT_PUBLIC_NFT_ADDR,
    desc: "Rives Score NFT ETH address."
  }),
  SCOREBOARD_CARTRIDGE_ID: str({
    input: process.env.NEXT_PUBLIC_SCOREBOARD_CARTRIDGE_ID,
    desc: "Cartridge id to consider scoreboard."
  }),
  SCOREBOARD_ID: str({
    input: process.env.NEXT_PUBLIC_SCOREBOARD_ID,
    desc: "Scoreboard id."
  })
})