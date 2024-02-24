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
        <div className='p-4 text-xs max-h-96 overflow-auto custom-scrollbar'>
            <h2 className='text-lg'>Summary</h2>
            <span>{selectedCartridge.info?.summary}</span>

            <h2 className='text-lg mt-4'>Description</h2>
            <pre className={fontPressStart2P.className} style={{whiteSpace: "pre-wrap"}}>
                {selectedCartridge.info?.description}
            </pre>
        </div>
    )
}

export default CartridgeDescription;