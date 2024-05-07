'use client'


import { createContext, useState } from 'react';
import { CartridgeInfo as Cartridge } from "../backend-libs/core/ifaces"

export const selectedCartridgeContext = createContext<{
    selectedCartridge: SelectedCartridge|null, changeCartridge:Function, fetchingCartridgeInfo():void
}>({selectedCartridge: null, changeCartridge: () => null, fetchingCartridgeInfo: () => null});


export interface SelectedCartridge extends Cartridge {
    fetching: boolean
}

export function SelectedCartridgeProvider({ children }:{ children: React.ReactNode }) {
    const [selectedCartridge, setSelectedCartridge] = useState<SelectedCartridge|null>(null);

    const changeCartridge = (cartridge:Cartridge|null) => {
        if (cartridge)
            setSelectedCartridge({...cartridge, fetching: false});
        else
            setSelectedCartridge(null);
    }

    const fetchingCartridgeInfo = () => {
        setSelectedCartridge({id: "", created_at: 0, name: "", user_address: "", authors: [], fetching: true});
    }

    return (
        <selectedCartridgeContext.Provider value={ {selectedCartridge, changeCartridge, fetchingCartridgeInfo} }>
            { children }
        </selectedCartridgeContext.Provider>
    );
}
