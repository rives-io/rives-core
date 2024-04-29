"use client"

import { getOutputs, RulesOutput, rules, VerifyPayloadInput } from '../backend-libs/core/lib';
import {  ethers } from "ethers";
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { envClient } from '../utils/clientEnv';
import React, { useContext, useEffect, useState } from 'react';
import { sha256 } from "js-sha256";
import { GetRulesPayload, RuleInfo } from '../backend-libs/core/ifaces';
import { ConstestStatus, Contest, getContestStatus } from '../utils/common';
import Link from 'next/link';
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import RuleLeaderboard from './RuleLeaderboard';

function PlayModes() {
    const {selectedCartridge} = useContext(selectedCartridgeContext);

    const [rulesInfo, setRulesInfo] = useState<RuleInfo[]>();
    const [selectedRule, setSelectedRule] = useState<string>();

    const contestsMetadata = envClient.CONTESTS as Record<string,Contest>;
    useEffect(() => {
        if (! selectedCartridge?.id) return;
        setSelectedRule(undefined);
        const inputPayload: GetRulesPayload = {
            cartridge_id: selectedCartridge?.id
        };
        rules(inputPayload, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true}).then((rules) => setRulesInfo(rules.data));
    }, [selectedCartridge?.id])

    if (!selectedCartridge) {
        return <></>;
    }
    
    return (
        <div className="grid grid-cols-2">
            <div>
            { rulesInfo ?
                rulesInfo.map((ruleInfo, index) => {
                    const status = ruleInfo ? getContestStatus(ruleInfo) : undefined;
                    return (
                        <div key={index}
                        className={"flex flex-row border-2 hover:border-black p-2 " + (ruleInfo.id == selectedRule ? "border-black" : "border-transparent")}
                        style={{cursor: "pointer"}}
                        onClick={() => setSelectedRule(ruleInfo.id)}
                        >
            
                        <div className="flex flex-col basis-3/4">
                            <span >{ruleInfo.name}</span>
                            {status ? <span className='text-xs'>
                                { ruleInfo.id in contestsMetadata ?
                                <Link href={`/contest/${ruleInfo.id}`} onClick={(e) => e.stopPropagation()} title='Contest page'>
                                    <MilitaryTechIcon className='text-[#ffd700]'/>
                                </Link>
                                : <></>}
                                Status: {ConstestStatus[status]}
                                </span> : <></>}
                        </div>

                        <Link href={`/play/rule/${ruleInfo.id}`} className="btn items-center flex flex-col basis-1/4"
                            onClick={(e) => e.stopPropagation()}>
                            PLAY
                        </Link>

                        </div>
                    )
                }
                ) : <></>
            }
            </div>
            <RuleLeaderboard cartridge_id={selectedCartridge.id} rule={selectedRule}/>
        </div>
    )
}

export default PlayModes;