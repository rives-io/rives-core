import { Suspense, useEffect, useState } from 'react';
import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import CachedIcon from '@mui/icons-material/Cached';
import {CACHE_OPTIONS_TYPE } from "cartesi-client";

import { envClient } from '../utils/clientEnv';



function scoreboardFallback() {
    const arr = Array.from(Array(3).keys());

    return (
        <table className="w-full text-sm text-left">
            <thead className="text-xsuppercase">
                <tr>
                    <th scope="col" className="px-6 py-3">
                        User
                    </th>
                    <th scope="col" className="px-6 py-3">
                        Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3">
                        Score
                    </th>
                </tr>
            </thead>
            <tbody className='animate-pulse'>
                {
                    arr.map((num, index) => {
                        return (
                            <tr key={index} className='mb-3 h-16'>
                                <td className="px-6 py-4 break-all">
                                    <div className='fallback-bg-color rounded-md'>
                                        0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        31/12/1969, 21:06:36
                                    </div>
                                </td>

                                <td className="px-6 py-4">
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


const getGeneralScoreboard = async (cartridge_id:string, cache: CACHE_OPTIONS_TYPE):Promise<Array<ReplayScore>> => {
    const scores:Array<ReplayScore> = await getOutputs({tags: ["score", cartridge_id]}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache});
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

function CartridgeScoreboard({cartridge_id, replay_function}:{cartridge_id:string,replay_function(replayScore: ReplayScore): void}) {
    const [generalScores,setGeneralScores] = useState<ReplayScore[]>([]);

    const playReplay = (replayScore:ReplayScore) => {
        replay_function(replayScore);
    }

    const reloadScores = async (cacheOption: CACHE_OPTIONS_TYPE | undefined = "force-cache") => {
        setGeneralScores((await getGeneralScoreboard(cartridge_id,cacheOption)).sort((a, b) => b.score - a.score));
    }
    
    useEffect(() => {
        reloadScores();
    },[cartridge_id]);
    
    return (
        <div className="relative">
        <Suspense fallback={scoreboardFallback()}>
        <button className="absolute top-0 right-0" onClick={() => reloadScores("no-store")}><span><CachedIcon/></span></button>
        <table className="w-full text-sm text-left">
            <thead className="text-xsuppercase">
                <tr>
                    <th scope="col" className="px-6 py-3">
                        User
                    </th>
                    <th scope="col" className="px-6 py-3">
                        Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3">
                        Score
                    </th>
                    <th scope="col" className="px-6 py-3">
                        
                    </th>
                </tr>
            </thead>
            <tbody>
                {
                    generalScores.map((scoreInfo, index) => {
                        return (
                            <tr key={`${scoreInfo.user_address}-${scoreInfo.timestamp}`} className="">

                                <td scope="row" className="px-6 py-4 break-all">
                                    {/* {score.user_address.substring(0, 7)}...{score.user_address.substring(score.user_address.length-5)} */}
                                    {setMedal(index)} {scoreInfo.user_address.substring(0,6)}...{scoreInfo.user_address.substring(scoreInfo.user_address.length-4,scoreInfo.user_address.length)}
                                </td>
                                <td className="px-6 py-4">
                                    {new Date(Number(scoreInfo.timestamp)*1000).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    {scoreInfo.score.toLocaleString()}
                                </td>
                                <td className="py-4">
                                    <button onClick={() => playReplay(scoreInfo)}><span><OndemandVideoIcon/></span></button>
                                </td>
                            </tr>
                        );
                    })
                }
            </tbody>
        </table>
        </Suspense>
        </div>
    )
}

export default CartridgeScoreboard;