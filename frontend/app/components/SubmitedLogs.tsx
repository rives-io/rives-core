import { cache } from 'react'
import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import { envClient } from '../utils/clientEnv';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { fontPressStart2P } from '../utils/font';


const getSubmitedLogs = cache(async (userAddress:string) => {
	const logs:Array<ReplayScore> = await getOutputs({msg_sender: userAddress, tags:["score"]},{cartesiNodeUrl: envClient.CARTESI_NODE_URL});
    return logs;
})


async function SubmitedLogs({userAddress}:{userAddress:string}) {
    const replay_logs = await getSubmitedLogs(userAddress)

    return (
        <div className="pb-4 overflow-y-auto">
            <div className={`sticky top-0 border-b border-current text-xs ${fontPressStart2P.className}`}>Total: {replay_logs.length}</div>
            <ul className="space-y-2 font-medium">
                {
                    replay_logs.map((log, index) => {
                        console.log(log._inputIndex.toLocaleString(), log._outputIndex.toLocaleString());
                        return (
                            <li className='border-b border-current' key={index}>
                                <div className='rounded flex flex-col p-2'>
                                    <span>{new Date(Number(log.timestamp.toLocaleString())*1000).toLocaleString()}</span>
                                    <span>Cartridge: {log.cartridge_id.substring(0,6)}...{log.cartridge_id.substring(log.cartridge_id.length-4,log.cartridge_id.length)}</span>
                                    <span>Score: {log.score.toLocaleString()}</span>
                                    <span>
                                        Status:
                                        <span className='text-green-500'>
                                            {
                                                !log._proof?
                                                    <span title='Validated inside Cartesi Machine'><CheckIcon/></span>
                                                :
                                                    <span title='Settled on-chain'><DoneAllIcon/></span>
                                            }
                                        </span>
                                    </span>
                                </div>
                            </li>
                        )
                    })
                }

            </ul>
        </div>
    )
}

export default SubmitedLogs