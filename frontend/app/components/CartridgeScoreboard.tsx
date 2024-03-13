"use client"

import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageIcon from '@mui/icons-material/Image';
import { envClient } from '../utils/clientEnv';
import React, { useEffect, useState } from 'react';



const getGeneralScoreboard = async (cartridge_id:string):Promise<Array<ReplayScore>> => {
    const tags = ["score", cartridge_id];
    if (cartridge_id == envClient.SCOREBOARD_CARTRIDGE_ID) {
        tags.push(envClient.SCOREBOARD_ID);
    }
    const scores:Array<ReplayScore> = await getOutputs({tags}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
    return scores;
}


const setMedal = (index:number) => {
    if (index == 0) {
        return <MilitaryTechIcon className='text-[#ffd700]' />;
    } else if (index == 1) {
        return <MilitaryTechIcon className='text-[#C0C0C0]' />;
    } else if (index == 2) {
        return <MilitaryTechIcon className='text-[#cd7f32]' />;
    }

    // add a margin that is the same size of the icon
    return <span className='ms-7'></span>;
}

function scoreboardFallback() {
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
                        Score
                    </th>
                    <th scope="col" className="px-2 py-3">
                        Status
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
                                <td className="px-2 py-4 break-all">
                                    <div className='ps-4 fallback-bg-color rounded-md'>
                                        0xf39F...2266
                                    </div>
                                </td>

                                <td className="px-2 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        31/12/1969, 21:06:36 PM
                                    </div>
                                </td>

                                <td className="px-2 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                                <td className="px-2 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
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

function CartridgeScoreboard({cartridge_id, reload, replay_function}:{
    cartridge_id:string, reload:number, replay_function(replayScore: ReplayScore): void}) {
    const [generalScores, setGeneralScore] = useState<ReplayScore[]|null>(null);

    const playReplay = (replayScore:ReplayScore) => {
        replay_function(replayScore);
    }

    const reloadScores = async () => {
        return (await getGeneralScoreboard(cartridge_id)).sort((a, b) => b.score - a.score);
    }

    useEffect(() => {
        if (generalScores) setGeneralScore(null) // set to null to trigger the loading effect

        reloadScores().then((scores) => setGeneralScore(scores));
    }, [cartridge_id, reload])

    if (!generalScores) {
        return scoreboardFallback();
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
                            Score
                        </th>
                        <th scope="col" className="px-2 py-3">
                            Status
                        </th>
                        <th scope="col" className="px-2 py-3">

                        </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        generalScores.map((scoreInfo, index) => {
                            return (
                                <tr key={index}>
                                    <td title={scoreInfo.user_address.toLowerCase()} scope="row" className="px-2 py-4 break-all">
                                        {setMedal(index)} {scoreInfo.user_alias? scoreInfo.user_alias:scoreInfo.user_address.substring(0,6)+"..."+scoreInfo.user_address.substring(scoreInfo.user_address.length-4,scoreInfo.user_address.length)}
                                    </td>
                                    <td className="px-2 py-4">
                                        {new Date(Number(scoreInfo.timestamp)*1000).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-4">
                                        {scoreInfo.score.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-4">
                                        {
                                            !scoreInfo._proof?
                                                <span title='Validated inside Cartesi Machine'><CheckIcon/></span>
                                            :
                                                <span title='Settled on-chain'><DoneAllIcon/></span>
                                        }
                                    </td>
                                    <td className="py-4">
                                        <button title='Play Log' className='scoreboard-btn' onClick={() => playReplay(scoreInfo)}><span><OndemandVideoIcon/></span></button>
                                        <button title='Mint Screenshot' className='scoreboard-btn' onClick={() => window.open(`/mint/${scoreInfo._inputIndex}`, "_blank", "noopener,noreferrer")}><span><ImageIcon/></span></button>
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

export default CartridgeScoreboard;