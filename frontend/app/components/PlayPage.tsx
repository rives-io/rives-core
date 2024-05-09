import { ethers } from "ethers";
import React from 'react'

import { RuleInfo } from "../backend-libs/core/ifaces";
import { rules } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from './RivemuPlayer';
import GameplaySubmitter from "./GameplaySubmitter";
import { ContestStatus, getContestStatus, getContestStatusMessage } from "../utils/common";


export default async function PlayPage({cartridge_id, rule_id}:{cartridge_id?: string, rule_id?:string}) {

    let errorMsg:string|null = null;

    if (!(rule_id || cartridge_id) ) {
        errorMsg = "No rule or cartridge";
    }

    let rule:RuleInfo|null = null;
    cartridge_id = cartridge_id? cartridge_id: "";
    const status = rule ? getContestStatus(rule) : ContestStatus.INVALID;

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
            <RivemuPlayer rule_id={rule_id}/>
            {[ContestStatus.IN_PROGRESS,ContestStatus.INVALID].indexOf(status) > -1 ? <GameplaySubmitter /> : <></>}
        </main>
    )
}