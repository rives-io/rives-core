"use client"


import { useContext } from 'react';
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import Link from 'next/link';
import { fontPressStart2P } from '../utils/font';

function CartridgeDescription() {
    const {selectedCartridge} = useContext(selectedCartridgeContext);

    if (!selectedCartridge) {
        return <></>;
    }

    return (
        <fieldset>
            <legend className='text-white mb-2'>
                <span className='text-4xl'>{selectedCartridge.name}</span>

                {
                    !(selectedCartridge.info?.authors)?
                        <div className='h-6'></div>
                    :
                    (
                        <div className='flex space-x-2'>
                            <span>By</span>
                            <ul>
                                {selectedCartridge.info?.authors?.map((author, index) => (
                                    <li key={author.name}>
                                        <Link href={author.link}>
                                            {author.name}{index !== selectedCartridge.info!.authors!.length-1? ",": ""}
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                        </div>
                    )
                }
            </legend>
            <div className='p-4 bg-gray-400 text-xs max-h-96 overflow-auto custom-scrollbar'>
                <h2 className='text-lg'>Summary</h2>
                <span>{selectedCartridge.info?.summary}</span>

                <h2 className='text-lg mt-4'>Description</h2>
                <pre className={fontPressStart2P.className} style={{whiteSpace: "pre-wrap"}}>
                    {selectedCartridge.info?.description}
                </pre>
            </div>
        </fieldset>
    )
}

export default CartridgeDescription;