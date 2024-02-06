import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import ImageIcon from '@mui/icons-material/Image';
import { envClient } from '../utils/clientEnv';
import React from 'react';



const getGeneralScoreboard = async (cartridge_id:string):Promise<Array<ReplayScore>> => {
    const scores:Array<ReplayScore> = await getOutputs({tags: ["score", cartridge_id]}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
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
    cartridge_id:string, reload:number, replay_function(replayScore: ReplayScore): void}) {

    const playReplay = (replayScore:ReplayScore) => {
        replay_function(replayScore);
    }

    const reloadScores = async () => {
        return (await getGeneralScoreboard(cartridge_id)).sort((a, b) => b.score - a.score);
    }

    const generalScores:ReplayScore[] = await reloadScores();

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

//export default CartridgeScoreboard;


const arePropsEqual = (prevProps:{cartridge_id:string, reload:number}, nextProps:{cartridge_id:string, reload:number}) => {
    // change cartridge || log validated reload or reload btn
    if ((prevProps.cartridge_id !== nextProps.cartridge_id) || (prevProps.reload !== nextProps.reload)) {
        return false                                   // will re-render
    }
    return true                                      // donot re-render
}

export default React.memo(CartridgeScoreboard, arePropsEqual)