"use client"

import { getOutputs, VerificationOutput } from '../backend-libs/core/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageIcon from '@mui/icons-material/Image';
import { envClient } from '../utils/clientEnv';
import React, { useEffect, useState } from 'react';



const getGeneralVerificationOutputs = async (cartridge_id:string,rule:string,page: number = 1,pageSize: number = 10):Promise<Array<VerificationOutput>> => {
    const tags = ["score", cartridge_id, rule];
    const scores:Array<VerificationOutput> = await getOutputs({tags,page,page_size:pageSize}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
    return scores;
}


const setMedal = (index:number) => {
    if (index == 0) {
        return <MilitaryTechIcon titleAccess={`Rank 1`} className='text-[#ffd700]' />;
    } else if (index == 1) {
        return <MilitaryTechIcon titleAccess={`Rank 2`} className='text-[#C0C0C0]' />;
    } else if (index == 2) {
        return <MilitaryTechIcon titleAccess={`Rank 3`} className='text-[#cd7f32]' />;
    }

    // add a margin that is the same size of the icon
    return <div title={`Rank ${index}`} className='inline-flex w-6 h-6 justify-center items-center'>{index}</div>;
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

                                <td className="px-2 py-2">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                                <td className="px-2 py-2">
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

function CartridgeScoreboard({cartridge_id, rule, reload, replay_function}:{
    cartridge_id:string, rule: string | undefined, reload:number, replay_function(replayScore: VerificationOutput): void}) {
    const [generalScores, setGeneralScore] = useState<VerificationOutput[]|null>(null);

    const playReplay = (replayScore:VerificationOutput) => {
        replay_function(replayScore);
    }

    const reloadScores = async () => {
        if (!rule) return [];
        return (await getGeneralVerificationOutputs(cartridge_id,rule)).
            sort((a, b) => 
                b.score != a.score ? 
                    b.score - a.score :
                    (a._timestamp || 0) - (b._timestamp || 0) );
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
                            const scoreDate = new Date(Number(scoreInfo.timestamp)*1000);
                            return (
                                <tr key={index}>
                                    <td title={scoreInfo.user_address.toLowerCase()} scope="row" className="px-2 py-2 break-all">
                                        {setMedal(index)} {scoreInfo.user_alias? scoreInfo.user_alias:scoreInfo.user_address.substring(0,6)+"..."+scoreInfo.user_address.substring(scoreInfo.user_address.length-4,scoreInfo.user_address.length)}
                                    </td>
                                    <td title={scoreDate.toLocaleString()} className="px-2 py-2">
                                        {scoreDate.toLocaleDateString()}
                                    </td>
                                    <td className="px-2 py-2">
                                        {scoreInfo.score.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2">
                                        {
                                            !scoreInfo._proof?
                                                <span title='Validated inside Cartesi Machine'><CheckIcon/></span>
                                            :
                                                <span title='Settled on-chain'><DoneAllIcon/></span>
                                        }
                                    </td>
                                    <td className="py-2">
                                        <button title='Tape' className='scoreboard-btn' onClick={() => replay_function(scoreInfo)}><span><OndemandVideoIcon/></span></button>
                                        <button title='Tape' className='scoreboard-btn' onClick={() => window.open(`/tapes/${scoreInfo.tape_hash.substring(2)}`, "_blank", "noopener,noreferrer")}><span><OndemandVideoIcon/></span></button>
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