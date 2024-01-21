import { cache } from 'react';
import { getOutputs } from '../backend-libs/app/lib';
import { ReplayScore } from '../backend-libs/app/ifaces';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';



const getGeneralScoreboard = cache(async (cartridge_id:string) => {
    const scores:Array<ReplayScore> = await getOutputs({tags: ["score", cartridge_id]});
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

async function CartridgeScoreboard({cartridge_id}:{cartridge_id:string}) {
    const generalScores = (await getGeneralScoreboard(cartridge_id)).sort((a, b) => b.score - a.score);

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
                            </tr>
                        );
                    })
                }
            </tbody>
        </table>

    )
}

export default CartridgeScoreboard;