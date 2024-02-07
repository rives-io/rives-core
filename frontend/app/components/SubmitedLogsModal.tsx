"use client"

import React, { Suspense, useState } from 'react'
import CloseIcon from './svg/CloseIcon';
import { useConnectWallet } from '@web3-onboard/react';
import SubmitedLogs from './SubmitedLogs';
import { fontPressStart2P } from '../utils/font';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';


function logsFallback() {
    const arr = Array.from(Array(10).keys());

    return (
        <div className="pb-4 overflow-y-auto">
            <div className={`sticky top-0 border-b border-current text-xs ${fontPressStart2P.className}`}>Total: <span className='fallback-bg-color rounded-md'>100</span></div>
            <ul className="space-y-2 font-medium">
                {
                    arr.map((val, index) => {
                        return (
                            <li key={index} className='border-b border-current'>
                                <div className='rounded flex flex-col p-2'>
                                    <span className='fallback-bg-color rounded-md'>31/12/1969, 21:06:36</span>
                                    <span>Cartridge: <span className='fallback-bg-color rounded-md'>0x4429...bb5c</span></span>
                                    <span>Score: <span className='fallback-bg-color rounded-md'>100</span></span>
                                    <span>Status: <span className='fallback-bg-color rounded-md'>100</span></span>
                                </div>
                            </li>
                        )
                    })
                }

            </ul>
        </div>
    )
}

function SubmitedLogsModal() {
    const [{ wallet }] = useConnectWallet();
    const [showHistory, setShowHistory] = useState(false);

    if (!wallet) return <></>;

    return (

    <>
        <div className="expand-log-btn">
            <button className={fontPressStart2P.className} onClick={()=>setShowHistory(true)}>
                <KeyboardArrowUpIcon/>
                Logs
            </button>
        </div>

        <div className={`${!showHistory? "hidden":""} absolute top-0 right-0 z-40 w-64 h-screen p-4 overflow-y-auto transition-transform bg-inherit`}>
            <h5 className={`text-base font-semibold uppercase ${fontPressStart2P.className}`}>Log History</h5>
            <button type="button" onClick={()=>setShowHistory(false)} className="bg-transparent rounded-lg text-sm p-1.5 absolute top-2.5 end-2.5 inline-flex items-center hover:bg-gray-400 dark:hover:bg-gray-600" >
                <CloseIcon/>
                <span className="sr-only">Close menu</span>
            </button>
            <Suspense fallback={logsFallback()}>
                <SubmitedLogs userAddress={wallet.accounts[0].address} provider={wallet.provider} />
            </Suspense>
        </div>
    </>

    )
}

export default SubmitedLogsModal