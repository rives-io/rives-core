"use client"

import React, { useContext, useEffect } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { CartridgeInfo as Cartridge } from "../backend-libs/app/ifaces"
import { cartridgeInfo } from '../backend-libs/app/lib';
import { fontPressStart2P } from '../utils/font';
import { envClient } from '../utils/clientEnv';

function CartridgeSelectButton({cartridge, index}:{cartridge:Cartridge, index:number}) {
    const {selectedCartridge, changeCartridge} = useContext(selectedCartridgeContext);

    useEffect(() => {
        const initialSelection = async () => {
           await handleCartridgeSelection({} as React.MouseEvent<HTMLElement>);
        }
        if (index == 0 && !selectedCartridge) initialSelection();
    })

    const handleCartridgeSelection = async (e:React.MouseEvent<HTMLElement>) => {

        const cartridgeWithInfo = await cartridgeInfo({id:cartridge.id},{decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"});

		changeCartridge(cartridgeWithInfo);
	}

    return (
        <button className={
            selectedCartridge?.id==cartridge.id?
                `games-list-item games-list-selected-item ${fontPressStart2P.className}`
            :
                `games-list-item ${fontPressStart2P.className}`
            } value={cartridge.id} onClick={handleCartridgeSelection}>

            {cartridge.name}
        </button>
    )
}

export default CartridgeSelectButton