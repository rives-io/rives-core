import { envClient } from "./clientEnv";

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

export async function getTapeGif(tape_id:string):Promise<string> {
    const response = await fetch(`${envClient.GIF_SERVER_URL}/gifs`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify([tape_id])
        }
    );

    const gif = await response.json();

    return gif[0];
}

export async function getTapesGifs(tapes:Array<string>):Promise<Array<string>> {
    if (tapes.length == 0) return [];
    
    const response = await fetch(`${envClient.GIF_SERVER_URL}/gifs`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(tapes)
        }
    );

    const gifs = await response.json();
    return gifs;
}

export async function insertTapeGif(gameplay_id:string, gifImage:string) {
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
}