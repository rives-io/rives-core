'use client'




import { createContext, useState } from 'react';


export const gameplayContext = createContext<{
    gameplay: Gameplay|null, setGameplayLog(gameplay:Gameplay):void
}>({gameplay: null, setGameplayLog: () => null});

export interface Outcard {
    value: Uint8Array,
    hash: string
}

export interface Gameplay {
    log: Uint8Array,
    outcard: Outcard
}

export function GameplayProvider({ children }:{ children: React.ReactNode }) {
    const [gameplay, setGameplay] = useState<Gameplay|null>(null);

    const setGameplayLog = (gameplay:Gameplay) => {
        setGameplay(gameplay);
    }

    return (
        <gameplayContext.Provider value={ {gameplay, setGameplayLog} }>
            { children }
        </gameplayContext.Provider>
    );
}