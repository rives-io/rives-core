'use client'


import { createContext, useState } from 'react';
import { CartridgeInfo as Cartridge } from "../backend-libs/app/ifaces"


export const selectedCartridgeContext = createContext<{
    selectedCartridge: PlayableCartridge|null, changeCartridge:Function, playCartridge:Function,
        setReplay:Function, setCartridgeData:Function, setGameParameters:Function,
        setGameplay:Function, stopCartridge:Function, setDownloadingCartridge:Function
}>({selectedCartridge: null, changeCartridge: () => null, playCartridge: () => null,
    setReplay: () => null, setCartridgeData: () => null, setGameParameters: () => null,
    setGameplay: () => null, stopCartridge: () => null, setDownloadingCartridge: () => null});

// export type Cartridge = {
// 	id: number,
// 	name: string,
// 	cover: string,
// 	desc: string
// }

export interface PlayableCartridge extends Cartridge {
    initCanvas: boolean;
    play: boolean;
    downloading: boolean;
    playToggle: boolean;
    cartridgeData: Uint8Array | undefined;
    inCard: Uint8Array | undefined;
    args: string | undefined;
    scoreFunction: string | undefined;
    replay: Uint8Array | undefined;
    gameplayLog: Uint8Array | undefined;
    outcard: Uint8Array | undefined;
    outhash: string | undefined;
}

export function SelectedCartridgeProvider({ children }:{ children: React.ReactNode }) {
    const [selectedCartridge, setSelectedCartridge] = useState<PlayableCartridge|null>(null);

    const changeCartridge = (cartridge:Cartridge) => {
        if (selectedCartridge?.downloading) return; // change only if download already finished

        const aux = {...cartridge, play:false, downloading:false, cartridgeData:undefined, inCard:undefined,
            args:undefined, scoreFunction:undefined, replay:undefined, gameplayLog:undefined,
            outcard:undefined, outhash:undefined, initCanvas:selectedCartridge?.initCanvas};
        setSelectedCartridge(aux as PlayableCartridge);
    }

    const playCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, gameplayLog:undefined, outcard:undefined, outhash:undefined, replay:undefined, playToggle:!selectedCartridge.playToggle, initCanvas:true});
        }
    }

    const stopCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:false, initCanvas:false});
        }
    }

    const setDownloadingCartridge = (download:boolean) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, downloading:download});
        }

    }

    const setReplay = (replay: Uint8Array) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, gameplayLog:undefined, outcard:undefined, outhash:undefined, replay, playToggle:!selectedCartridge.playToggle, initCanvas:true});
        }
    }

    const setCartridgeData = (cartridgeData: Uint8Array) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, downloading:false, cartridgeData});
        }
    }

    const setGameParameters = (args: string, inCard: Uint8Array, scoreFunction: string) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, args, inCard, scoreFunction, gameplayLog:undefined, replay:undefined});
        }
    }

    const setGameplay = (gameplayLog: Uint8Array, outcard: Uint8Array, outhash: string) => {
        if (selectedCartridge) {
            if (outcard == undefined)
                if (gameplayLog == undefined)
                    setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, outhash});
                else
                    setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, outhash, play: true, playToggle:!selectedCartridge.playToggle, initCanvas:true});
            else
                setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, outhash});
        }
    }

    return (
        <selectedCartridgeContext.Provider value={ {selectedCartridge, changeCartridge, playCartridge,
                setReplay, setCartridgeData, setGameParameters,
                setGameplay, stopCartridge, setDownloadingCartridge} }>
            { children }
        </selectedCartridgeContext.Provider>
    );
}
