"use client"


import { useContext } from 'react';
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { fontPressStart2P } from '../utils/font';

function CartridgeDescription() {
    const {selectedCartridge} = useContext(selectedCartridgeContext);

    if (!selectedCartridge) {
        return <></>;
    }

    return (
        <div>
            <fieldset>
                <legend className='font-bold text-xl'>Sumary</legend>
                <p className='text-sm'>{selectedCartridge.info?.summary}</p>
            </fieldset>

            <fieldset>
                <legend className='font-bold text-xl'>Description</legend>
                <pre className={`${fontPressStart2P.className} text-sm`} style={{whiteSpace: "pre-wrap"}}>
                    {selectedCartridge.info?.description}
                </pre>
            </fieldset>
        </div>
    )
}

export default CartridgeDescription;