'use client'


import { createContext, useState } from 'react';


export const selectedCartridgeContext = createContext<{
    selectedCartridge: PlayableCartridge|null, changeCartridge:Function, playCartridge:Function
}>({selectedCartridge: null, changeCartridge: () => null, playCartridge: () => null});

export type Cartridge = {
	id: number,
	name: string,
	cover: string,
	desc: string
}

type PlayableCartridge = Cartridge & {play: boolean};

export function SelectedCartridgeProvider({ children }:{ children: React.ReactNode }) {
    const [selectedCartridge, setSelectedCartridge] = useState<PlayableCartridge|null>(null);

    const changeCartridge = (cartridge:Cartridge) => {
        const aux:PlayableCartridge = {...cartridge, play:false};
        setSelectedCartridge(aux);
    }

    const playCartridge = () => {
        if (selectedCartridge) {
            setSelectedCartridge({...selectedCartridge, play:true});
        }
    }

    return (
        <selectedCartridgeContext.Provider value={ {selectedCartridge, changeCartridge, playCartridge} }>
            { children }
        </selectedCartridgeContext.Provider>
    );
}
