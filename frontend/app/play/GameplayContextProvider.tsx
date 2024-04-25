'use client'




import { createContext, useState } from 'react';


export const gameplayContext = createContext<{
    gameplay: Gameplay|null, setGameplayLog(gameplay:Gameplay):void,
    getGifParameters():GifParameters, setGifResolution(width:number, height:number):void,
    setGifFrames(frames:Array<string>):void, addGifFrame(frame:string):void, clearGifFrames():void
}>({gameplay: null, setGameplayLog: () => null, 
    getGifParameters: () => {return {width:0, height:0, frames:[]}}, setGifResolution: () => null, 
    setGifFrames: () => null, addGifFrame: () => null,
    clearGifFrames: () => null});

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
    const [gifRes, setGifRes] = useState<{width:number, height:number}|null>(null);
    const [gifFrameArray, setGifFrameArray] = useState<Array<string>>([]);

    const setGameplayLog = (gameplay:Gameplay) => {
        setGameplay(gameplay);
    }

    const setGifResolution = (width:number, height:number) => {
        setGifRes({width:width, height:height});
    }

    const setGifFrames = (frames:Array<string>) => {
        const startAt = frames.length > GIF_SIZE? frames.length - GIF_SIZE: 0;
        setGifFrameArray(frames.slice(startAt));
    }

    const addGifFrame = (frame:string) => {
        if (gifFrameArray.length + 1 <= GIF_SIZE) {
            setGifFrameArray([...gifFrameArray, frame])
        } else {
            // throw away the oldest frame
            setGifFrameArray([...gifFrameArray.slice(1), frame])
        }
    }

    const getGifParameters = ():GifParameters => {
        if (!gifRes) throw new Error("Undefined GIF Resolution!");
        if (gifFrameArray.length == 0) throw new Error("No GIF frames found!");

        return {width: gifRes.width, height: gifRes.height, frames: gifFrameArray}
    }

    const clearGifFrames = () => {
        setGifFrames([]);
    }

    return (
        <gameplayContext.Provider value={ {gameplay, setGameplayLog, setGifResolution, setGifFrames, addGifFrame, clearGifFrames, getGifParameters} }>
            { children }
        </gameplayContext.Provider>
    );
}