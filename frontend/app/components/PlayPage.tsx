import { ethers } from "ethers";
import React from 'react'

import { RuleInfo } from "../backend-libs/core/ifaces";
import { rules } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from './RivemuPlayer';
import GameplaySubmitter from "./GameplaySubmitter";
import { ContestStatus, getContestStatus, getContestStatusMessage } from "../utils/common";


const getRule = async (ruleId:string):Promise<RuleInfo> => {
    const formatedRuleId = ruleId;
    const data = await rules(
        {
            id:formatedRuleId
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

export default async function PlayPage({cartridge_id, rule_id}:{cartridge_id?: string, rule_id?:string}) {

    let errorMsg:string|null = null;

    if (!(rule_id || cartridge_id) ) {
        errorMsg = "No rule or cartridge";
    }

    let rule:RuleInfo|null = null;
    cartridge_id = cartridge_id? cartridge_id: "";
    if (rule_id) {
        rule = await getRule(rule_id);
        cartridge_id = rule.cartridge_id;
    }
    const status = rule ? getContestStatus(rule) : undefined;

    // Rivemu parameters
    const args = rule?.args || "";
    const in_card = rule?.in_card && rule.in_card.length > 0 ? ethers.utils.arrayify(rule.in_card) : new Uint8Array([]);
    const score_function = rule?.score_function || "";

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

    return (
        <main className="flex h-lvh items-center justify-center">
            <div className="grid grid-cols-1 gap-1 place-items-center ">
                <span className="text-white">{rule ? "Play mode: " + rule?.name : "No play mode"}</span>
                {status ? <span className="text-xs text-white">Contest Status: {getContestStatusMessage(status)}</span> : <></>}
                <RivemuPlayer cartridge_id={cartridge_id} rule_id={rule_id} args={args} in_card={in_card} scoreFunction={score_function} />
                {!status || status == ContestStatus.IN_PROGRESS ? <GameplaySubmitter /> : <></>}
            </div>
        </main>
    )
}