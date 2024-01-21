import { str, envsafe } from 'envsafe';


export const envClient = envsafe({
  DAPP_ADDR: str({
    input: process.env.NEXT_PUBLIC_DAPP_ADDR,
    desc: "Cartesi DApp ETH address."
  })
})