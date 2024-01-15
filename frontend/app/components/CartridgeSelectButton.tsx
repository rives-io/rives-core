"use client"

import React, { useContext } from 'react'
import { Cartridge, selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';

function CartridgeSelectButton({cartridge}:{cartridge:Cartridge}) {
    const {selectedCartridge, changeCartridge} = useContext(selectedCartridgeContext);

    const handleCartridgeSelection = (e:React.MouseEvent<HTMLElement>) => {
		changeCartridge(cartridge);
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