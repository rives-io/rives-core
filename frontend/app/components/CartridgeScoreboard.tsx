import { cache } from 'react';
import { scoreboards, scores } from '../backend-libs/app/lib';
import { ScoreInfo, ScoreboardsOutput } from '../backend-libs/app/ifaces';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';



const getGeneralScoreboard = cache(async (cartridge_id:string) => {
    const res:ScoreboardsOutput = await scoreboards({cartridge_id:cartridge_id, name: "simple"}, {decode: true});
    const generalScoreboard = res.data[0];

    const generalScores:Array<ScoreInfo> = (await scores({scoreboard_id: generalScoreboard.id}, {decode: true})).data;
    console.log(generalScores);
    
    return generalScores;
})


const scoreMockList:Array<ScoreInfo> = [
    {score: 0, timestamp: new Date().getMilliseconds(), user_address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"},
    {score: 1, timestamp: new Date().getMilliseconds(), user_address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"},
    {score: 2, timestamp: new Date().getMilliseconds(), user_address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"},
    {score: 3, timestamp: new Date().getMilliseconds(), user_address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"},
    {score: 4, timestamp: new Date().getMilliseconds(), user_address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"}
]

const setMedal = (index:number) => {
    if (index == 0) {
        return <MilitaryTechIcon className='text-yellow-500' />;
    } else if (index == 1) {
        return <MilitaryTechIcon className='text-gray-500' />;
    } else if (index == 2) {
        return <MilitaryTechIcon className='text-orange-500' />;
    }

    // add a margin that is the same size of the icon
    return <span className='ms-7'></span>;
}

async function CartridgeScoreboard({cartridge_id}:{cartridge_id:string}) {
    const generalScores = await getGeneralScoreboard(cartridge_id);

    let scoreList;
    if (generalScores.length == 0) {
        scoreList = scoreMockList;
    } else {
        scoreList = generalScores;
    }
    scoreList = scoreList.sort((a, b) => b.score - a.score);

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
                    scoreList.map((score, index) => {
                        return (
                            <tr key={`${score.user_address}-${score.timestamp}`} className="">
                                
                                <td scope="row" className="px-6 py-4 break-all">
                                    {/* {score.user_address.substring(0, 7)}...{score.user_address.substring(score.user_address.length-5)} */}
                                    {setMedal(index)} {score.user_address}
                                </td>
                                <td className="px-6 py-4">
                                    {new Date(score.timestamp*1000).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    {score.score}
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


// const getScoreboards = cache(async (cartridge_id:string) => {
//     const res:ScoreboardsOutput = await scoreboards({cartridge_id:cartridge_id}, {decode: true});
//     console.log(res)
//     return res;
// })


// async function CartridgeScoreboardList({cartridge_id}:{cartridge_id:string}) {

//     const selectedCartridgeScoreboards = await getScoreboards(cartridge_id);

//     return (
//         <div className='flex flex-col'>
//             {
//                 selectedCartridgeScoreboards.data.map((scoreboard) => {
//                     return (
//                         <button key={scoreboard.id} className="leaderboard-card">
//                             <div className='flex'>
//                                 <span className='text-lg font-semibold me-auto'>{scoreboard.name}</span>
//                                 <span className='ms-auto'>{new Date(scoreboard.created_at*1000).toLocaleString()}</span>
//                             </div>

//                             <div className='flex flex-col items-start'>
//                                 <span>Creator: {scoreboard.created_by}</span>
//                                 <span>Score Function: {scoreboard.score_function}</span>
//                             </div>
//                         </button>
//                     )
//                 })
//             }
//         </div>
//     )
// }

// export default CartridgeScoreboardList;