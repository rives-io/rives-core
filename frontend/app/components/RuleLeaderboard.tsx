"use client"

import { getOutputs, VerifyPayloadInput } from '../backend-libs/core/lib';
import {  ethers } from "ethers";
import { envClient } from '../utils/clientEnv';
import React, { useEffect, useState } from 'react';
import { sha256 } from "js-sha256";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { useConnectWallet } from '@web3-onboard/react';

const DEFAULT_PAGE_SIZE = 10;

const getGeneralVerificationPayloads = async (
cartridge_id:string, rule:string, page:number
):Promise<Array<VerifyPayloadInput>> => {
    
    const tags = ["tape",cartridge_id,rule];
    const tapes:Array<VerifyPayloadInput> = await getOutputs(
        {
            tags,
            type: 'input',
            page,
            page_size: DEFAULT_PAGE_SIZE,
            order_by: "timestamp",
            order_dir: "desc"
        },
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
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

function RuleLeaderboard({cartridge_id, rule}:{
    cartridge_id:string, rule: string | undefined}) {
    const [tapePayloads, setTapePayloads] = useState<VerifyPayloadInput[]|null>([]);

    // pageination state
    const [currPage, setCurrPage] = useState(1);
    const [pageToLoad, setPageToLoad] = useState(1);
    const [atEnd, setAtEnd] = useState(false);
    const [oldRule, setOldRule] = useState<string>();

    // user
    const [{ wallet }] = useConnectWallet();
    const userAddress = wallet? wallet.accounts[0].address.toLocaleLowerCase(): null;


    const reloadScores = async () => {
        if (!rule) return [];
        return (await getGeneralVerificationPayloads(cartridge_id, rule, pageToLoad))
    }

    const previousPage = () => {
        setPageToLoad(currPage-1);
    }

    const nextPage = () => {
        setPageToLoad(currPage+1);
    }

    useEffect(() => {
        let newRule = false;
        if (rule != oldRule) {
            setTapePayloads([]);
            setOldRule(rule);
            newRule = true;
        }
        const currTapes = tapePayloads;
        if (tapePayloads) setTapePayloads(null) // set to null to trigger the loading effect

        reloadScores().then((scores) => {
            if (scores.length == 0 && !newRule) {
                setAtEnd(true);
                setTapePayloads(currTapes || []);
                return;
            } else if (scores.length < DEFAULT_PAGE_SIZE) {
                setAtEnd(true);
            }
            
            setTapePayloads(scores);
            setCurrPage(pageToLoad);
        });
    }, [pageToLoad,rule])

    useEffect(() => {
        setTapePayloads([]);
    }, [cartridge_id])

    if (!tapePayloads) {
        return tapesBoardFallback();
    }

    if (tapePayloads.length == 0) {
        return (
            <div className='relative text-center'>
                <span>No gameplays submitted yet!</span>
            </div>
        )
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
                    </tr>
                </thead>
                <tbody>
                    {
                        tapePayloads.map((tape, index) => {
                            const tapeDate = new Date(Number(tape._timestamp)*1000);
                            const userTape = userAddress == tape._msgSender?.toLocaleLowerCase();
                            return (
                                <tr key={index} onClick={() => window.open(`/tapes/${getTapeId(tape.tape)}`, "_blank", "noopener,noreferrer")}
                                className={`p-4 hover:games-list-selected-item ${userTape? "bg-gray-500":""}`}
                                style={{cursor: "pointer"}}
                                >
                                    <td title={tape._msgSender?.toLowerCase()} scope="row" className="px-2 py-2 break-all">
                                        {tape._msgSender?.substring(0,6)+"..."+tape._msgSender?.substring(tape._msgSender?.length-4,tape._msgSender?.length)}
                                    </td>
                                    <td title={tapeDate.toLocaleString()} className="px-2 py-2">
                                        {tapeDate.toLocaleDateString()} {tapeDate.toLocaleTimeString()}
                                    </td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </table>

            <div className='flex justify-center items-center space-x-1'>
                    <button disabled={currPage == 1} onClick={previousPage} className={`border border-transparent ${currPage != 1? "hover:border-black":""}`}>
                        <NavigateBeforeIcon />
                    </button>
                    <span>
                        {currPage}
                    </span>
                    <button disabled={atEnd} onClick={nextPage} className={`border border-transparent ${!atEnd? "hover:border-black":""}`}>
                        <NavigateNextIcon />                
                    </button>
            </div>
        </div>
    )
}

export default RuleLeaderboard;