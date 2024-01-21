"use client"


import { useContext } from 'react';
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';

function CartridgeDescription() {
    const {selectedCartridge} = useContext(selectedCartridgeContext);

    if (!selectedCartridge) {
        return <></>;
    }

    return (
        <div>
            <fieldset>
                <legend className='font-bold text-xl'>Sumary</legend>
                <p>{selectedCartridge.info?.summary}</p>
            </fieldset>

            <fieldset>
                <legend className='font-bold text-xl'>Description</legend>
                <pre style={{whiteSpace: "pre-wrap"}}>
                    {selectedCartridge.info?.description}
                </pre>
            </fieldset>
        </div>
    )
}

export default CartridgeDescription;