"use client"

import { rules } from '../backend-libs/core/lib';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { envClient } from '../utils/clientEnv';
import React, { useContext, useEffect, useState } from 'react';
import { GetRulesPayload, RuleInfo } from '../backend-libs/core/ifaces';
import { ContestStatus, Contest, getContestStatus, getContestStatusMessage } from '../utils/common';
import Link from 'next/link';
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import RuleLeaderboard from './RuleLeaderboard';

function PlayModes() {
    const {selectedCartridge} = useContext(selectedCartridgeContext);

    const [rulesInfo, setRulesInfo] = useState<RuleInfo[]>();
    const [selectedRule, setSelectedRule] = useState<RuleInfo>();

    const contestsMetadata = envClient.CONTESTS as Record<string,Contest>;
    useEffect(() => {
        if (! selectedCartridge?.id) return;
        setSelectedRule(undefined);
        const inputPayload: GetRulesPayload = {
            cartridge_id: selectedCartridge?.id
        };
        rules(inputPayload, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true}).then((rules) => {
            setRulesInfo(rules.data);
            if (rules.data.length > 0) setSelectedRule(rules.data[0]);
        });
    }, [selectedCartridge?.id])

    if (!selectedCartridge) {
        return <></>;
    }
    
    return (
        <div className="grid grid-cols-2">
            <div>
            { rulesInfo ?
                rulesInfo.map((ruleInfo, index) => {
                    const status = ruleInfo ? getContestStatus(ruleInfo) : ContestStatus.INVALID;
                    const available = [ContestStatus.INVALID,ContestStatus.IN_PROGRESS].indexOf(status) > -1;
                    return (
                        <div key={index}
                        className={"flex flex-row border-2 hover:border-black p-2 " + (ruleInfo.id == selectedRule?.id ? "border-black" : "border-transparent")}
                        style={{cursor: "pointer"}}
                        onClick={() => setSelectedRule(ruleInfo)}
                        >
            
                        <div className="flex flex-col basis-3/4">
                            <span >{ruleInfo.name}</span>
                            {status != ContestStatus.INVALID ? <span className='text-xs'>
                                { ruleInfo.id in contestsMetadata ?
                                <Link href={`/contests/${ruleInfo.id}`} onClick={(e) => e.stopPropagation()} title='Contest page'>
                                    <MilitaryTechIcon className='text-[#ffb700] hover:text-[#ff8000]'/>
                                </Link>
                                : <></>}
                                {getContestStatusMessage(status)}
                                </span> : <></>}
                        </div>

                        <Link href={`/play/rule/${ruleInfo.id}`} className="btn items-center flex flex-col basis-1/4"
                            onClick={(e) => e.stopPropagation()} style={{height:"50px",pointerEvents: available ? "auto":"none",}}>
                            PLAY
                        </Link>

                        </div>
                    )
                }
                ) : <></>
            }
            </div>
            <RuleLeaderboard cartridge_id={selectedCartridge.id} rule={selectedRule?.id} 
                get_verification_outputs={selectedRule != undefined && [ContestStatus.INVALID,ContestStatus.VALIDATED].indexOf(getContestStatus(selectedRule)) > -1 } 
            />
        </div>
    )
}

export default PlayModes;