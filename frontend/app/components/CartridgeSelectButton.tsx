"use client"

import React, { useContext } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { CartridgeInfo as Cartridge } from "../backend-libs/app/ifaces"
import { cartridgeInfo } from '../backend-libs/app/lib';

function CartridgeSelectButton({cartridge}:{cartridge:Cartridge}) {
    const {selectedCartridge, changeCartridge} = useContext(selectedCartridgeContext);

    const handleCartridgeSelection = async (e:React.MouseEvent<HTMLElement>) => {

        const cartridgeWithInfo = await cartridgeInfo({id:cartridge.id},{decode:true});

        console.log('Select')
        
		changeCartridge(cartridgeWithInfo);
	}

    return (
        <button className={
            selectedCartridge?.id==cartridge.id?
                "games-list-item games-list-selected-item"
            :
                "games-list-item"
            } value={cartridge.id} onClick={handleCartridgeSelection}>

            {cartridge.name}
        </button>
    )
}

export default CartridgeSelectButton