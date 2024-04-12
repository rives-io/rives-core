'use client'


import { createContext, useState } from 'react';
import { CartridgeInfo as Cartridge } from "../backend-libs/core/ifaces"
import { envClient } from '../utils/clientEnv';

import { rules, RulesOutput } from '../backend-libs/core/lib';
import { InspectReport } from '../backend-libs/cartesapp/utils';

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
    cartridgeData?: Uint8Array;
    inCard?: Uint8Array;
    args?: string;
    scoreFunction?: string;
    replay?: Uint8Array;
    gameplayLog?: Uint8Array;
    outcard?: Uint8Array;
    outhash?: string;
    score?: number;
    rule?: string;
    lastFrames?: string[];
    height?: number;
    width?: number;
    replayUserAddress?: string;
    replayRule?: string;
}

export function SelectedCartridgeProvider({ children }:{ children: React.ReactNode }) {
    const [selectedCartridge, setSelectedCartridge] = useState<PlayableCartridge|null>(null);

    const changeCartridge = (cartridge:Cartridge) => {
        if (selectedCartridge?.downloading) return; // change only if download already finished

        rules({cartridge_id:cartridge.id,name:"default"},{cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"}).then(
            (reportOutput: InspectReport) => {
                let aux = {...cartridge, play:false, downloading:false, cartridgeData:undefined, inCard:undefined,
                    args:undefined, scoreFunction:undefined, rule:undefined, 
                    height: undefined, width: undefined, replayUserAddress: undefined, replayRule: undefined,
                    score: undefined, replay:undefined, gameplayLog:undefined,
                    outcard:undefined, outhash:undefined, initCanvas:selectedCartridge?.initCanvas};
        
                const output = new RulesOutput(reportOutput);
                if (output.total > 0) {
                    const lastInd = output.data.length - 1;
                    aux.args = output.data[lastInd].args;
                    aux.inCard = output.data[lastInd].in_card;
                    aux.scoreFunction = output.data[lastInd].score_function;
                    aux.rule = output.data[lastInd].id;
                }
                setSelectedCartridge(aux as PlayableCartridge);
            }
        );
    }

    const playCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true, gameplayLog:undefined, outcard:undefined, outhash:undefined, replay:undefined, initCanvas:true});
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

    const setReplay = (replayRule: string, replay: Uint8Array, replayUserAddress: string) => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:false, gameplayLog:undefined, outcard:undefined, outhash:undefined, replay, replayRule, replayUserAddress, initCanvas:true});
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

    const setGameplay = (gameplayLog: Uint8Array, outcard: Uint8Array, outhash: string, score?: number, 
            lastFrames?: string[], height?: number, width?: number,) => {
        if (selectedCartridge) {
            if (outcard == undefined)
                if (gameplayLog == undefined)
                    setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, outhash, score, lastFrames, height, width});
                else
                    setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, outhash, score, lastFrames, height, width, play: true, initCanvas:true});
            else
                setSelectedCartridge({...selectedCartridge, gameplayLog, outcard, outhash, score, lastFrames, height, width});
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
