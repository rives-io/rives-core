import { cache } from 'react'
import { getOutputs, ReplayScore } from '../backend-libs/app/lib';
import { envClient } from '../utils/clientEnv';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ClearIcon from '@mui/icons-material/Clear';
import { fontPressStart2P } from '../utils/font';
import { EIP1193Provider } from "@web3-onboard/common/dist/types";
import { BigNumber, ethers } from 'ethers';
import { InputBox__factory } from "cartesi-client/node_modules/@cartesi/rollups";
import { getReport } from "cartesi-client"


interface ErrorLog {
    inputIndex:number,
    timestamp:number,
    error:string
}

const getSubmitedLogs = cache(async (userAddress:string) => {
	const logs:Array<ReplayScore> = await getOutputs({msg_sender: userAddress, tags:["score"]},{cartesiNodeUrl: envClient.CARTESI_NODE_URL});
    return logs;
})

const getErrors = cache(async (missingLogsIndexes:Array<BigNumber>) => {
    let errors:Array<ErrorLog> = [];

    for (let i = 0; i < missingLogsIndexes.length; i++) {
        const inputIndex = missingLogsIndexes[i];
        const report = await getReport(`${envClient.CARTESI_NODE_URL}/graphql`, inputIndex.toNumber());

        if (report.input.status === "REJECTED") {
            errors.push({
                inputIndex: report.input.index,
                timestamp: report.input.timestamp,
                error: ethers.utils.toUtf8String(report.payload)
            })
        }
    }

    return errors;
})

async function getUserInputsIndexes(address:string, provider:EIP1193Provider) {
    const web3Provider = new ethers.providers.Web3Provider(provider);
    const DEFAULT_INPUT_BOX_ADDRESS = "0x59b22D57D4f067708AB0c00552767405926dc768"
    const inputContract = InputBox__factory.connect(
        DEFAULT_INPUT_BOX_ADDRESS,
        web3Provider
    );

    let inputIndexes:Array<BigNumber> = [];

    const filter = inputContract.filters.InputAdded(envClient.DAPP_ADDR);
    const events = await inputContract.queryFilter(filter, 0, "latest");

    address = address.toLowerCase();
    events.forEach((event) => {
        if (event.args[2].toLowerCase() === address) {
            inputIndexes.push(event.args[1])
        }
    })

    return inputIndexes;
}

function logBinarySearch(logs:Array<ReplayScore>, inputIndex:BigNumber):boolean {
    const inputIndexNumber = inputIndex.toNumber();

    if (logs.length === 0) return false;
    if (logs.length === 1) {
        if (logs[0]._inputIndex === inputIndexNumber) {
            return true;
        } else {
            return false;
        }
    }

    const middle = logs.length/2;
    let result = true;
    if (logs[middle]._inputIndex > inputIndexNumber) {
        // from 0 to middle (not included)
        result = logBinarySearch(logs.slice(0, middle), inputIndex);
    } else if (logs[middle]._inputIndex < inputIndexNumber) {
        // from middle+1 to end
        result = logBinarySearch(logs.slice(middle+1, logs.length), inputIndex);
    }

    return result;
}

function buildSortedLogs(replayLogs:Array<ReplayScore>, errorLogs:Array<ErrorLog>) {
    if (replayLogs.length === 0) return errorLogs as Array<ReplayScore|ErrorLog>;
    if (errorLogs.length === 0) return replayLogs as Array<ReplayScore|ErrorLog>;

    let logs:Array<ReplayScore|ErrorLog> = [];
    let currentIndex = 0;

    if (replayLogs[replayLogs.length-1]._inputIndex > errorLogs[errorLogs.length-1].inputIndex) {
        replayLogs.forEach((replay) => {
            while (currentIndex < errorLogs.length && replay._inputIndex > errorLogs[currentIndex].inputIndex) {
                logs.push(errorLogs[currentIndex]);
                currentIndex++;
            }

            logs.push(replay);
        })
    } else {
        errorLogs.forEach((error) => {
            while (currentIndex < replayLogs.length && error.inputIndex > replayLogs[currentIndex]._inputIndex) {
                logs.push(replayLogs[currentIndex]);
                currentIndex++;
            }

            logs.push(error);
        })

    }

    return logs;
}

async function SubmitedLogs({userAddress, provider}:{userAddress:string, provider:EIP1193Provider}) {
    const replayLogs = await getSubmitedLogs(userAddress)
    const inputIndexes = await getUserInputsIndexes(userAddress, provider);

    let missingLogsIndexes:Array<BigNumber> = [];
    if (replayLogs.length !== inputIndexes.length) {
        inputIndexes.forEach((inputIndex) => {
            if (!logBinarySearch(replayLogs, inputIndex)) {
                missingLogsIndexes.push(inputIndex);
            }
        })
    }

    const errorLogs:Array<ErrorLog> = await getErrors(missingLogsIndexes);
    const logs:Array<ReplayScore|ErrorLog> = buildSortedLogs(replayLogs, errorLogs);


    return (
        <div className="pb-4 overflow-y-auto">
            <div className={`sticky top-0 border-b border-current text-xs ${fontPressStart2P.className}`}>Total: {logs.length}</div>
            <ul className="space-y-2 font-medium">
                {
                    logs.map((log, index) => {

                        return (
                            <li className='border-b border-current' key={index}>
                                <div className='rounded flex flex-col p-2'>
                                    {
                                        log.timestamp?
                                            <span>{new Date(Number(log.timestamp.toLocaleString())*1000).toLocaleString()}</span>
                                        :
                                            "Undefined Timestamp"
                                    }

                                    {
                                        log.error?
                                            <span>
                                                Status: <span title={log.error} className='text-red-500'><ClearIcon/></span>
                                            </span>
                                        :
                                            <>
                                                <span>Cartridge:
                                                    {(log as ReplayScore).cartridge_id.substring(0,6)}
                                                    ...
                                                    {(log as ReplayScore).cartridge_id.substring((log as ReplayScore).cartridge_id.length-4,(log as ReplayScore).cartridge_id.length)}
                                                </span>
                                                <span>Score: {(log as ReplayScore).score.toLocaleString()}</span>
                                                <span>
                                                    Status:
                                                    <span className='text-green-500'>
                                                        {
                                                            !(log as ReplayScore)._proof?
                                                                <span title='Validated inside Cartesi Machine'><CheckIcon/></span>
                                                            :
                                                                <span title='Settled on-chain'><DoneAllIcon/></span>
                                                        }
                                                    </span>
                                                </span>
                                            </>
                                    }

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