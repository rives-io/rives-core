import { ethers } from "ethers";

import { VerificationOutput,VerifyPayload,cartridge, getOutputs, rules } from '@/app/backend-libs/core/lib';
import { RuleInfo } from '@/app/backend-libs/core/ifaces';
import { envClient } from '@/app/utils/clientEnv';
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from '@/app/components/RivemuPlayer';


const getScoreInfo = async (tapeId:string):Promise<VerificationOutput> => {
    const scores:Array<VerificationOutput> = await getOutputs(
        {
            tags: ["score",tapeId],
        }, {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );

    if (scores.length === 0) throw new Error(`Verification output not found for tape ${tapeId}!`);
    
    return scores[0];
}

const getCartridgeData = async (cartridgeId:string):Promise<Uint8Array> => {
    const formatedCartridgeId = cartridgeId.slice(2);
    const data = await cartridge(
        {
            id:formatedCartridgeId
        },
        {
            decode:true,
            decodeModel:"bytes",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    
    if (data.length === 0) throw new Error(`Cartridge ${formatedCartridgeId} not found!`);
    
    return data;
}


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

const getRule = async (cartridgeId:string,ruleId:string):Promise<RuleInfo> => {
    const data = await rules(
        {
            cartridge_id:cartridgeId,
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


export default async function Tape({ params }: { params: { tape_id: string } }) {
    let errorMsg:string|undefined = undefined;
    let scoreInfo:VerificationOutput|undefined = undefined;
    let cartridgeData:Uint8Array|undefined = undefined;
    let tapePayload:VerifyPayload|undefined = undefined;
    let tape:Uint8Array|undefined = undefined;
    let inCard:Uint8Array|undefined = undefined;
    let rule:RuleInfo|undefined = undefined;
    
    try {
        const scorePromise = getScoreInfo(params.tape_id);
        const tapePayloadPromise = getTapePayload(params.tape_id);
        
        scoreInfo = await scorePromise;
        cartridgeData = await getCartridgeData(scoreInfo.cartridge_id);
        
        tapePayload = await tapePayloadPromise;
        const tapeData = tapePayload.tape;
        if (typeof tapeData != "string" || !ethers.utils.isHexString(tapeData))
            throw new Error("Corrupted tape");
        tape = ethers.utils.arrayify(tapeData);
        
        rule = await getRule(scoreInfo.cartridge_id.slice(2),tapePayload.rule_id.slice(2));
        
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

    if (!scoreInfo) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Info...
            </main>
        )
    }

    if (!cartridgeData) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Cartridge...
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

    return (
        <main className="flex items-center justify-center h-lvh">
            <RivemuPlayer cartridge_id={rule.cartridge_id} rule_id={rule.id} cartridgeData={cartridgeData} args={rule.args} in_card={inCard} scoreFunction={rule.score_function} tape={tape} userAddress={tapePayload._msgSender} />
        </main>
    )
}

