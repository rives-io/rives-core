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
  CONTESTS: str({
    input: process.env.NEXT_PUBLIC_CONTESTS,
    desc: "Contests json list."
  })
})