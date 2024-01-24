'use client'


import { createContext, useState } from 'react';
import { CartridgeInfo as Cartridge } from "../backend-libs/app/ifaces"


export const selectedCartridgeContext = createContext<{
    selectedCartridge: PlayableCartridge|null, changeCartridge:Function, playCartridge:Function, 
        setReplay:Function, setCartridgeData:Function, setGameParameters:Function, 
        setGameplay:Function, stopCartridge:Function
}>({selectedCartridge: null, changeCartridge: () => null, playCartridge: () => null, 
    setReplay: () => null, setCartridgeData: () => null, setGameParameters: () => null, 
    setGameplay: () => null, stopCartridge: () => null});

// export type Cartridge = {
// 	id: number,
// 	name: string,
// 	cover: string,
// 	desc: string
// }

export interface PlayableCartridge extends Cartridge {
    initCanvas: boolean;
    play: boolean;
    playToggle: boolean;
    cartridgeData: Uint8Array | undefined;
    inCard: Uint8Array | undefined;
    args: string | undefined;
    scoreFunction: string | undefined;
    replay: Uint8Array | undefined;
    gameplayLog: Uint8Array | undefined;
    outcard: string | undefined;
}

export function SelectedCartridgeProvider({ children }:{ children: React.ReactNode }) {
    const [selectedCartridge, setSelectedCartridge] = useState<PlayableCartridge|null>(null);

    const changeCartridge = (cartridge:Cartridge) => {
        const aux = {...cartridge, play:false, cartridgeData:undefined, inCard:undefined, 
            args:undefined, scoreFunction:undefined, replay:undefined, gameplayLog:undefined, 
            outcard:undefined, initCanvas:selectedCartridge?.initCanvas};
        setSelectedCartridge(aux as PlayableCartridge);
    }
 
    const playCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, replay:undefined, playToggle:!selectedCartridge.playToggle, initCanvas:true});
        }
    }

    const stopCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:false});
        }
    }

    const setReplay = (replay: Uint8Array) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, gameplayLog:undefined, outcard:undefined, replay, playToggle:!selectedCartridge.playToggle, initCanvas:true});
        }
    }

    const setCartridgeData = (cartridgeData: Uint8Array) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, cartridgeData});
        }
    }

    const setGameParameters = (args: string, inCard: Uint8Array, scoreFunction: string) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, args, inCard, scoreFunction, gameplayLog:undefined, replay:undefined});
        }
    }
    
    const setGameplay = (gameplayLog: Uint8Array, outcard: string) => {
        if (selectedCartridge) {
            if (outcard == undefined)
                if (gameplayLog == undefined)
                    setSelectedCartridge({...selectedCartridge, gameplayLog, outcard});
                else
                    setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, play: true, playToggle:!selectedCartridge.playToggle, initCanvas:true});
            else
                setSelectedCartridge({...selectedCartridge, gameplayLog, outcard});
        }
    }
    
    return (
        <selectedCartridgeContext.Provider value={ {selectedCartridge, changeCartridge, playCartridge, 
                setReplay, setCartridgeData, setGameParameters, 
                setGameplay, stopCartridge} }>
            { children }
        </selectedCartridgeContext.Provider>
    );
}
