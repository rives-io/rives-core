import { envClient } from "./clientEnv";
import { anvil, base, mainnet, sepolia, polygon, polygonMumbai, Chain } from 'viem/chains';
import { isHex, fromHex } from 'viem'

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function formatDate(date:Date) {
    const options:Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }
    
    return date.toLocaleString(undefined, options);
}

export async function getTapeGif(tape_id:string):Promise<string|null> {
    try {
        const response = await fetch(`${envClient.GIF_SERVER_URL}/gifs`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify([tape_id])
            }
        );

        if (!response.ok || response.status === 204) return null;

        const gif = await response.json();

        return gif[0];
    } catch (e) {
        console.log(`Error fetching gif: ${e}`)
        return null;
    }
}

export async function getTapesGifs(tapes:Array<string>):Promise<Array<string>> {
    if (tapes.length == 0) return [];
    
    try {
        const response = await fetch(`${envClient.GIF_SERVER_URL}/gifs`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(tapes)
            }
        );

        if (!response.ok) return [];

        const gifs = await response.json();
        return gifs;
    } catch (e) {
        console.log(`Error fetching gifs: ${e}`)
        return [];
    }
}

export async function insertTapeGif(gameplay_id:string, gifImage:string) {
    try {
        await fetch(
            `${envClient.GIF_SERVER_URL}/insert-gif`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "gameplay_id": gameplay_id,
                    "gif": gifImage
                })
            }
        )
    } catch (e) {
        console.log(`Error inserting gif: ${e}`)
    }
}

export async function useCode(payload:string) {
    const response = await fetch(
        `${envClient.GIF_SERVER_URL}/useCode`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "codeSession": payload
            })
        }
    )

    return await response.json();
}

export async function validateCode(payload:string) {
    const response = await fetch(
        `${envClient.GIF_SERVER_URL}/validateCode`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "codeSession": payload
            })
        }
    )

    return await response.json();
}

export async function getTapeImage(tape_id:string):Promise<string|null> {
    try {
        const response = await fetch(`${envClient.GIF_SERVER_URL}/images`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify([tape_id])
            }
        );

        if (!response.ok) return null;

        const imgs = await response.json();

        return imgs[0];
    } catch (e) {
        console.log(`Error fetching image: ${e}`)
        return null;
    }
}

export async function getTapesImages(tapes:Array<string>):Promise<Array<string>> {
    if (tapes.length == 0) return [];
    
    try {
        const response = await fetch(`${envClient.GIF_SERVER_URL}/images`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(tapes)
            }
        );

        if (!response.ok) return [];

        const imgs = await response.json();
        return imgs;
    } catch (e) {
        console.log(`Error fetching images: ${e}`)
        return [];
    }
}

export async function insertTapeImage(gameplay_id:string, gifImage:string) {
    try {
        await fetch(
            `${envClient.GIF_SERVER_URL}/insert-image`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "gameplay_id": gameplay_id,
                    "image": gifImage
                })
            }
        )
    } catch (e) {
        console.log(`Error inserting image: ${e}`)
    }
}

let chains:Record<number, Chain> = {};
chains[base.id] = base;
chains[mainnet.id] = mainnet;
chains[sepolia.id] = sepolia;
chains[polygon.id] = polygon;
chains[polygonMumbai.id] = polygon;
chains[anvil.id] = anvil;

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