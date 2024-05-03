import { ethers } from "ethers";

import { VerificationOutput, VerifyPayload, getOutputs, rules } from '@/app/backend-libs/core/lib';
import { RuleInfo } from '@/app/backend-libs/core/ifaces';
import { envClient } from '@/app/utils/clientEnv';
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from '@/app/components/RivemuPlayer';
import { getTapeGif } from "@/app/utils/util";
import { ContestStatus, formatBytes, getContestStatus } from '../../utils/common';


const getTapePayload = async (tapeId:string):Promise<VerifyPayload> => {
    const replayLogs:Array<VerifyPayload> = await getOutputs(
        {
            tags: ["tape",tapeId],
            type: 'input'
        },
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );
    if (replayLogs.length === 0) throw new Error(`Tape ${tapeId} not found!`);
    return replayLogs[0];
}

const getRule = async (ruleId:string):Promise<RuleInfo> => {
    const data = await rules(
        {
            id:ruleId
        },
        {
            decode:true,
            decodeModel:"RulesOutput",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    
    if (data.total === 0 || data.data.length === 0) throw new Error(`Rule ${ruleId} not found!`);
    
    return data.data[0];
}

const getScore = async (tapeId:string):Promise<string> => {
    const out:Array<VerificationOutput> = await getOutputs(
        {
            tags: ["score",tapeId],
            type: 'notice'
        },
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );
    if (out.length === 0) return "";
    return out[0].score.toString();
}


// or Dynamic metadata
export async function generateMetadata({ params }: { params: { tape_id: string } }) {
    const gifImage = await getTapeGif(params.tape_id);

    return {
        openGraph: {
          images: ["data:image/gif;base64,"+gifImage],
        },
    }

}

export default async function Tape({ params }: { params: { tape_id: string } }) {
    let errorMsg:string|undefined = undefined;
    let tapePayload:VerifyPayload|undefined = undefined;
    let tape:Uint8Array|undefined = undefined;
    let inCard:Uint8Array|undefined = undefined;
    let rule:RuleInfo|undefined = undefined;
    
    try {
        tapePayload = await getTapePayload(params.tape_id);
        const tapeData = tapePayload.tape;
        if (typeof tapeData != "string" || !ethers.utils.isHexString(tapeData))
            throw new Error("Corrupted tape");
        tape = ethers.utils.arrayify(tapeData);
        
        rule = await getRule(tapePayload.rule_id.slice(2));
        
        if (!rule)
            throw new Error("Can't find rule");

        if (typeof rule.in_card != "string" || rule.in_card.length > 0 && !ethers.utils.isHexString(rule.in_card))
            throw new Error("Corrupted in card");
        if (rule.in_card.length > 0)
            inCard = ethers.utils.arrayify(rule.in_card);
        else
            inCard = undefined;

    } catch (error) {
        console.log("error",error)
        errorMsg = (error as Error).message;
    }

    // BEGIN: error and feedback handling
    if (errorMsg) {
        return (
            <main className="flex items-center justify-center h-lvh">
                <div className='flex w-96 flex-wrap break-all justify-center'>
                    <ReportIcon className='text-red-500 text-5xl' />
                    <span style={{color: 'white'}}> {errorMsg}</span>
                </div>
            </main>
        )
    }

    if (!tape || !tapePayload) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Tape...
            </main>
        )
    }
    if (!rule) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Rule...
            </main>
        )
    }
    // END: error and feedback handling

    const player = `${tapePayload._msgSender.slice(0, 6)}...${tapePayload._msgSender.substring(tapePayload._msgSender.length-4,tapePayload._msgSender.length)}`;
    const timestamp = new Date(tapePayload._timestamp*1000).toLocaleDateString();
    const size = formatBytes(tape.length);
    let score = "";
    if ([ContestStatus.INVALID,ContestStatus.VALIDATED].indexOf(getContestStatus(rule)) > -1) {
        score = await getScore(params.tape_id)
    }

    return (
        <main className="flex items-center justify-center h-lvh">
            <div className="grid grid-cols-1 gap-2 place-items-center">
                <span className="text-white" >Play mode: {rule.name}</span>
                <span className="text-xs text-white">Tape from {player} on {timestamp} {score ? "with score "+score : ""} ({size})</span>
                <RivemuPlayer cartridge_id={rule.cartridge_id} rule_id={rule.id} args={rule.args} in_card={inCard} scoreFunction={rule.score_function} tape={tape} userAddress={tapePayload._msgSender} />
            </div>
        </main>
    )
}

