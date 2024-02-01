import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import {CACHE_OPTIONS_TYPE } from "cartesi-client";

import { envClient } from '../utils/clientEnv';
import React from 'react';



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

async function CartridgeScoreboard({cartridge_id, reload, replay_function}:{
    cartridge_id:string, reload:boolean, replay_function(replayScore: ReplayScore): void}) {

    const playReplay = (replayScore:ReplayScore) => {
        replay_function(replayScore);
    }

    const reloadScores = async (cacheOption: CACHE_OPTIONS_TYPE | undefined = "force-cache") => {
        return (await getGeneralScoreboard(cartridge_id, cacheOption)).sort((a, b) => b.score - a.score);
    }

    let generalScores:ReplayScore[];
    if (reload) {
        generalScores = await reloadScores("no-store");
    } else {
        generalScores = await reloadScores();
    }

    return (
        <div className="relative">
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
        </div>
    )
}

//export default CartridgeScoreboard;


const notRender = (prevProps:{cartridge_id:string, reload:boolean}, nextProps:{cartridge_id:string, reload:boolean}) => {
    if ((prevProps.cartridge_id !== nextProps.cartridge_id) || nextProps.reload) {
      return false                                   // will re-render
    }
    return true                                      // donot re-render
}

export default React.memo(CartridgeScoreboard, notRender)