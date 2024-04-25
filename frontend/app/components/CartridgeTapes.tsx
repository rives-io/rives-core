"use client"

import { getOutputs, VerifyPayloadInput } from '../backend-libs/core/lib';
import {  ethers } from "ethers";
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import ImageIcon from '@mui/icons-material/Image';
import { envClient } from '../utils/clientEnv';
import React, { useEffect, useState } from 'react';
import { sha256 } from "js-sha256";



const getGeneralVerificationPayloads = async (cartridge_id:string,rule:string,page: number = 1,pageSize: number = 10):Promise<Array<VerifyPayloadInput>> => {
    const tags = ["tape",cartridge_id,rule];
    const tapes:Array<VerifyPayloadInput> = await getOutputs({tags,type: 'input',page,page_size:pageSize}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
    return tapes;
}

function tapesBoardFallback() {
    const arr = Array.from(Array(3).keys());

    return (
        <table className="w-full text-xs text-left">
            <thead className="text-xsuppercase">
                <tr>
                    <th scope="col" className="px-2 py-3">
                        User
                    </th>
                    <th scope="col" className="px-2 py-3">
                        Timestamp
                    </th>
                    <th scope="col" className="px-2 py-3">

                    </th>
                </tr>
            </thead>
            <tbody className='animate-pulse'>
                {
                    arr.map((num, index) => {
                        return (
                            <tr key={index}>
                                <td className="px-2 py-2 break-all">
                                    <div className='ps-4 fallback-bg-color rounded-md'>
                                        0xf39F...2266
                                    </div>
                                </td>

                                <td className="px-2 py-2">
                                    <div className='fallback-bg-color rounded-md'>
                                        31/12/1969, 21:06:36 PM
                                    </div>
                                </td>

                                <td className="w-[50px] h-[56px]">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                }

            </tbody>
        </table>
    )
}

function CartridgeTapes({cartridge_id, rule, reload, replay_function}:{
    cartridge_id:string, rule: string | undefined, reload:number, replay_function(replayScore: VerifyPayloadInput): void}) {
    const [tapePayloads, setTapePayloads] = useState<VerifyPayloadInput[]|null>(null);

    const playReplay = (replayScore:VerifyPayloadInput) => {
        replay_function(replayScore);
    }

    const reloadScores = async () => {
        if (!rule) return [];
        return (await getGeneralVerificationPayloads(cartridge_id,rule)).
            sort((a, b) => (a._timestamp || 0) - (b._timestamp || 0) );
    }

    useEffect(() => {
        if (tapePayloads) setTapePayloads(null) // set to null to trigger the loading effect

        reloadScores().then((scores) => setTapePayloads(scores));
    }, [cartridge_id, reload])

    if (!tapePayloads) {
        return tapesBoardFallback();
    }

    function getTapeId(tapeHex: string): String {
        return sha256(ethers.utils.arrayify(tapeHex));
    }

    return (
        <div className="relative">
            <table className="w-full text-xs text-left">
                <thead className="text-xsuppercase">
                    <tr>
                        <th scope="col" className="px-2 py-3">
                            User
                        </th>
                        <th scope="col" className="px-2 py-3">
                            Timestamp
                        </th>
                        <th scope="col" className="px-2 py-3">

                        </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        tapePayloads.map((tape, index) => {
                            const tapeDate = new Date(Number(tape._timestamp)*1000);
                            return (
                                <tr key={index}>
                                    <td title={tape._msgSender?.toLowerCase()} scope="row" className="px-2 py-2 break-all">
                                        {tape._msgSender?.substring(0,6)+"..."+tape._msgSender?.substring(tape._msgSender?.length-4,tape._msgSender?.length)}
                                    </td>
                                    <td title={tapeDate.toLocaleString()} className="px-2 py-2">
                                        {tapeDate.toLocaleDateString()}
                                    </td>
                                    <td className="py-2">
                                        <button title='Tape' className='scoreboard-btn' onClick={() => replay_function(tape)}><span><OndemandVideoIcon/></span></button>
                                        <button title='Tape' className='scoreboard-btn' onClick={() => window.open(`/tapes/${getTapeId(tape.tape)}`, "_blank", "noopener,noreferrer")}><span><OndemandVideoIcon/></span></button>
                                    </td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </table>
        </div>
    )
}

export default CartridgeTapes;