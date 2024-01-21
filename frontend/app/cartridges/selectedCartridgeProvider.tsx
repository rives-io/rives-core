'use client'


import { createContext, useState } from 'react';
import { CartridgeInfo as Cartridge } from "../backend-libs/app/ifaces"


export const selectedCartridgeContext = createContext<{
    selectedCartridge: PlayableCartridge|null, changeCartridge:Function, playCartridge:Function, 
        setReplayInfo:Function, setCartridgeData:Function, setGamePatrameters:Function, 
        setGameplay:Function, stopCartridge:Function
}>({selectedCartridge: null, changeCartridge: () => null, playCartridge: () => null, 
    setReplayInfo: () => null, setCartridgeData: () => null, setGamePatrameters: () => null, 
    setGameplay: () => null, stopCartridge: () => null});

// export type Cartridge = {
// 	id: number,
// 	name: string,
// 	cover: string,
// 	desc: string
// }

export interface ReplayInfo {
    userAddress: string;
    timestamp: number;
    score: number;
    scoreType: string;
    extraScore: number;
}
export interface PlayableCartridge extends Cartridge {
    play: boolean;
    playToggle: boolean;
    cartridgeData: Uint8Array | undefined;
    inCard: Uint8Array | undefined;
    args: string | undefined;
    scoreFunction: string | undefined;
    replayInfo: ReplayInfo | undefined;
    gameplayLog: Uint8Array | undefined;
    outcard: string | undefined;
}

export function SelectedCartridgeProvider({ children }:{ children: React.ReactNode }) {
    const [selectedCartridge, setSelectedCartridge] = useState<PlayableCartridge|null>(null);

    const changeCartridge = (cartridge:Cartridge) => {
        const aux = {...cartridge, play:false, cartridgeData:undefined, inCard:undefined, 
            args:undefined, scoreFunction:undefined, replayInfo:undefined, gameplayLog:undefined, outcard:undefined};
        setSelectedCartridge(aux as PlayableCartridge);
    }
 
    const playCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, replayInfo:undefined, playToggle:!selectedCartridge.playToggle});
        }
    }

    const stopCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:false});
        }
    }

    const setReplayInfo = (replayInfo: ReplayInfo) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, gameplayLog:undefined, replayInfo});
        }
    }

    const setCartridgeData = (cartridgeData: Uint8Array) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, cartridgeData});
        }
    }

    const setGamePatrameters = (args: string, inCard: Uint8Array, scoreFunction: string) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, args, inCard, scoreFunction, gameplayLog:undefined, replayInfo:undefined});
        }
    }
    
    const setGameplay = (gameplayLog: Uint8Array, outcard: string) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, gameplayLog, outcard});
        }
    }
    
    return (
        <selectedCartridgeContext.Provider value={ {selectedCartridge, changeCartridge, playCartridge, 
                setReplayInfo, setCartridgeData, setGamePatrameters, 
                setGameplay, stopCartridge} }>
            { children }
        </selectedCartridgeContext.Provider>
    );
}
