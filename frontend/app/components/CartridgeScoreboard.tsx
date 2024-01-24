import { cache } from 'react';
import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import { envClient } from '../utils/clientEnv';





const getGeneralScoreboard = cache(async (cartridge_id:string) => {
    const scores:Array<ReplayScore> = await getOutputs({tags: ["score", cartridge_id]}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
    return scores;
})


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

async function CartridgeScoreboard({cartridge_id, replay_function}:{cartridge_id:string,replay_function(replayScore: ReplayScore): void}) {
    const generalScores = (await getGeneralScoreboard(cartridge_id)).sort((a, b) => b.score - a.score);

    const playReplay = (replayScore:ReplayScore) => {
        replay_function(replayScore);
    }
    
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
                                    {setMedal(index)} {scoreInfo.user_address}
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

    )
}

export default CartridgeScoreboard;