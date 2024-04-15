"use client"

import React, { useContext, useEffect } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { CartridgeInfo as Cartridge } from "../backend-libs/core/ifaces"
import { cartridgeInfo } from '../backend-libs/core/lib';
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
                `games-list-item games-list-selected-item`
            :
                `games-list-item`
            } value={cartridge.id} onClick={handleCartridgeSelection}>

            {cartridge.name}
        </button>
    )
}

export default CartridgeSelectButton