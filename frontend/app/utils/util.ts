import { useRef, useEffect } from 'react'
import { base, mainnet, sepolia, polygon, polygonMumbai, Chain } from 'viem/chains';
import { isHex, fromHex } from 'viem'


export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}


export function usePrevious(value: any) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    },[value]);
    return ref.current;
}


let chains:Record<number, Chain> = {};
chains[base.id] = base;
chains[mainnet.id] = mainnet;
chains[sepolia.id] = sepolia;
chains[polygon.id] = polygon;
chains[polygonMumbai.id] = polygon;

export function getChain(chainId:number):Chain;
export function getChain(chainId:string):Chain;
export function getChain(chainId:number|string) {
    if (typeof chainId === "string") {
        if (!isHex(chainId)) return null;
        chainId = fromHex(chainId, "number");
    }

    const chain = chains[chainId];
    if (!chain) return null;

    return chain;
}
