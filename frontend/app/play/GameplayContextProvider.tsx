'use client'




import { createContext, useState } from 'react';


export const gameplayContext = createContext<{
    gameplay: Gameplay|null, setGameplayLog(gameplay:Gameplay):void,
    gifParameters: GifParameters|null, setGifResolution(width:number, height:number):void,
    setGifFrames(frames:Array<string>):void, addGifFrame(frame:string):void, clear():void
}>({gameplay: null, setGameplayLog: () => null, 
    gifParameters:null, setGifResolution: () => null, 
    setGifFrames: () => null, addGifFrame: () => null,
    clear: () => null});

export interface Outcard {
    value: Uint8Array,
    hash: string
}

export interface Gameplay {
    cartridge_id: string,
    log: Uint8Array,
    outcard: Outcard,
    score?: number,
    rule_id: string
}

export interface GifParameters {
    width: number,
    height: number,
    frames: string[]
}

export const GIF_SIZE = 20;
export const GIF_FRAME_FREQ = 4;

export function GameplayProvider({ children }:{ children: React.ReactNode }) {
    const [gameplay, setGameplay] = useState<Gameplay|null>(null);
    const [gifParameters, setGifParameters] = useState<GifParameters>({width: 0, height: 0, frames: []});

    const setGameplayLog = (gameplay:Gameplay) => {
        setGameplay(gameplay);
    }

    const setGifResolution = (width:number, height:number) => {
        setGifParameters({...gifParameters, width:width, height:height});
    }

    const setGifFrames = (frames:Array<string>) => {
        const startAt = frames.length > GIF_SIZE? frames.length - GIF_SIZE: 0;
        setGifParameters({...gifParameters, frames: frames.slice(startAt)});
    }

    const addGifFrame = (frame:string) => {
        if (gifParameters.frames.length + 1 <= GIF_SIZE) {
            setGifParameters({...gifParameters, frames: [...gifParameters.frames, frame]})
        } else {
            // throw away the oldest frame
            setGifParameters({...gifParameters, frames: [...gifParameters.frames.slice(1), frame]})
        }
    }

    const clear = () => {
        setGameplay(null);
        setGifParameters({width: 0, height: 0, frames: []});
    }

    return (
        <gameplayContext.Provider value={ {gameplay, setGameplayLog, gifParameters, setGifResolution, setGifFrames, addGifFrame, clear} }>
            { children }
        </gameplayContext.Provider>
    );
}