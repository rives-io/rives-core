"use client"


import React, { useContext } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';


function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
async function movePageToBottom() {
    await delay(1000);
    window.scrollTo({left: 0, top: document.body.scrollHeight, behavior: 'smooth'});
}

function Rivemu() {
    const {selectedCartridge} = useContext(selectedCartridgeContext);

    if (!selectedCartridge || !selectedCartridge?.play) {
        return <></>;
    }

    movePageToBottom();

    return (
        <section className='h-svh'>
            RIVEMU CANVAS SECTION
        </section>
    )
}

export default Rivemu