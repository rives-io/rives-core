"use client"

import React from 'react'
import { Parser } from "expr-eval";
import { ethers } from "ethers";
import Script from "next/script"
import { useContext, useState, useEffect, useRef } from "react";
import { useConnectWallet } from '@web3-onboard/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import InputLabel from '@mui/material/InputLabel';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import StopIcon from '@mui/icons-material/Stop';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FastForwardIcon from '@mui/icons-material/FastForward';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import UploadIcon from '@mui/icons-material/Upload';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { DemoContainer, DemoItem } from '@mui/x-date-pickers/internals/demo';
import { sha256 } from "js-sha256";
import { envClient } from "../utils/clientEnv";
import { CartridgesOutput, cartridge, cartridgeInfo, cartridges, createRule, insertCartridge, rules, ruleTags as getRuleTags, RuleTagsOutput } from "../backend-libs/core/lib";
import Rivemu, { RivemuRef } from "./Rivemu";
import { CartridgeInfo, RuleInfo, InfoCartridge, CartridgePayload, RuleData, InserCartridgePayload } from "../backend-libs/core/ifaces";

import ErrorModal, { ERROR_FEEDBACK } from "./ErrorModal";

const darkTheme = createTheme({
    palette: {
       mode: 'dark',
    },
});

export interface TapeInfo {
    player?: string,
    timestamp?: string,
    size?: string,
    score?: string,
}


const getCartridges = async ():Promise<CartridgeInfo[]> => {
    const out: CartridgesOutput = await cartridges(
        {
        },
        {
            decode:true,
            decodeModel:"CartridgesOutput",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    const data: CartridgeInfo[] = out.data;
    
    return data;
}

const getCartridgeData = async (cartridgeId:string):Promise<Uint8Array> => {
    const formatedCartridgeId = cartridgeId.substring(0, 2) === "0x"? cartridgeId.slice(2): cartridgeId;
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

function generateEntropy(userAddress?:String, ruleId?:String): string {

    const hexRuleId = `0x${ruleId}`;
    if (!userAddress || userAddress.length != 42 || !ethers.utils.isHexString(userAddress) || !ethers.utils.isHexString(hexRuleId)) {
        return "";
    }

    const userBytes = ethers.utils.arrayify(`${userAddress}`);
    const ruleIdBytes = ethers.utils.arrayify(hexRuleId);

    var fullEntropyBytes = new Uint8Array(userBytes.length + ruleIdBytes.length);
    fullEntropyBytes.set(userBytes);
    fullEntropyBytes.set(ruleIdBytes, userBytes.length);
    return sha256(fullEntropyBytes);
}

const getRules = async (cartridge_id:string):Promise<RuleInfo[]> => {
    if (!cartridge_id) return [];
    const data = await rules(
        {
            cartridge_id
        },
        {
            decode:true,
            decodeModel:"RulesOutput",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    
    return data.data as RuleInfo[];
}

function RivemuEditor() {
    // rivemu state
    const [cartridgeData, setCartridgeData] = useState<Uint8Array>();
    const [rule, setRule] = useState<RuleInfo|null>();
    const [tape, setTape] = useState<Uint8Array>();

    // Control
    const [ruleList, setRuleList] = useState<readonly RuleInfo[]>([]);
    const [cartridgeList, setCartridgeList] = useState<readonly CartridgeInfo[]>([]);//([{name:"test",id:"test",info:{} as any,user_address:"",created_at:0,authors:[]}]);
    const [selectedCartridge, setSelectedCartridge] = useState<CartridgeInfo|null>();
    const [entropy, setEntropy] = useState<string>("entropy");
    const [currScore, setCurrScore] = useState<number>();
    const [playing, setPlaying] = useState({isPlaying: false, isReplay:false, playCounter: 0})
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState(1.0);
    const [outcard, setOutcard] = useState<string>();

    const [cartridgesComboOpen, setCartridgesComboOpen] = useState(false);
    const [rulesComboOpen, setRulesComboOpen] = useState(false);
    const [storedCartridge, setStoredCartridge] = useState(false);
    const [ruleInCard, setRuleIncard] = useState<Uint8Array>();
    const [ruleInCardHash, setRuleIncardHash] = useState<string>();
    const [ruleArgs, setRuleArgs] = useState<string>();
    const [ruleScoreFunction, setRuleScoreFunction] = useState<string>();
    const [ruleName, setRuleName] = useState<string>();
    const [ruleDescription, setRuleDescription] = useState<string>();
    const [ruleStart, setRuleStart] = useState<Dayjs>();
    const [ruleEnd, setRuleEnd] = useState<Dayjs>();
    const [ruleCartridgeTags, setRuleCartridgeTags] = useState<string[]>();
    const [ruleTags, setRuleTags] = useState<string[]>();
    const cartridgeFileRef = useRef<HTMLInputElement | null>(null);
    const incardFileRef = useRef<HTMLInputElement | null>(null);
    const [enableRuleEditing, setEnableRuleEditing] = useState(false);
    const [showCartridgeInfo, setShowCartridgeInfo] = useState(false);
    const [infoCartridge, setInfoCartridge] = useState<InfoCartridge>();
    const [restarting, setRestarting] = useState(false);

    const [errorFeedback, setErrorFeedback] = useState<ERROR_FEEDBACK>();

    const filter = createFilterOptions<string>();

    // signer
    const [{ wallet }] = useConnectWallet();

    const rivemuRef = useRef<RivemuRef>(null);
    
    useEffect(() => {
        document.addEventListener("visibilitychange", (event) => {
            if (document.visibilityState == "hidden") {
                rivemuRef.current?.setSpeed(0);
                setPaused(true);
            }
          });
    }, []);

    useEffect(() => {
        if (!wallet) {
            setEntropy("entropy");
        }
        else {
            setEntropy(generateEntropy(wallet.accounts[0].address.toLowerCase(), rule?.id || ""));
        }
    },[wallet]);

    useEffect(() => {
        if (cartridgesComboOpen && cartridgeList.length == 0) {
          loadCartridgeList();
        }
    }, [cartridgesComboOpen]);

    useEffect(() => {
        if (storedCartridge && selectedCartridge && rulesComboOpen && ruleList.length == 0) {
          loadRuleList(selectedCartridge.id);
        }
    }, [rulesComboOpen]);

    useEffect(() => {
        setRuleName(rule?.name);
        setRuleArgs(rule?.args);
        setRuleDescription(rule?.description);
        setRuleScoreFunction(rule?.score_function);
        const incard = rule?.in_card && rule.in_card.length > 0 ? ethers.utils.arrayify(rule.in_card) : new Uint8Array([]);
        setRuleIncard(incard);
        setRuleIncardHash(sha256(incard));
        setRuleStart(rule?.start && rule.start > 0 ? dayjs.unix(rule.start) : undefined);
        setRuleEnd(rule?.end && rule.end > 0 ? dayjs.unix(rule.end) : undefined);
        getRuleTags(
            {
                cartridge_id: rule?.cartridge_id
            },
            {
                decode:true,
                decodeModel:"RuleTagsOutput",
                cartesiNodeUrl: envClient.CARTESI_NODE_URL,
                cache:"force-cache"
            }
        ).then( (out:RuleTagsOutput) => {
            setRuleCartridgeTags(out.tags);
            setRuleTags(rule?.tags);
        });
    }, [rule]);

    useEffect(() => {
        if (playing.isPlaying && !playing.isReplay && tape && tape.length == 0) {
            rivemuRef.current?.start();
        }
    }, [playing.isPlaying,playing.isReplay,tape]);

    useEffect(() => {
        setInfoCartridge({name:"test",tags:[]});
    }, [cartridgeData]);

    const loadCartridgeList = () => {
        if (cartridgeList && cartridgeList.length > 0) return;
        getCartridges().then((data) => {
            setCartridgeList(data);
        });
    }

    const loadRuleList = (cartridgeId: string) => {
        if (ruleList && ruleList.length > 0) return;
        getRules(cartridgeId).then((data) => {
            setRuleList(data);
        });
    }

    const selectCartridge = (newCartridge: CartridgeInfo|null) => {
        setSelectedCartridge(newCartridge);
        setRuleList([]);
        setRule(undefined);
        setTape(new Uint8Array([]));
        setOutcard(undefined);
        if (playing.isPlaying) rivemuRef.current?.stop();
        if (newCartridge) {
            setStoredCartridge(false);
            getCartridgeData(newCartridge.id).then((data) => {
                setCartridgeData(data);
                setStoredCartridge(true);
            });
        } else {
            setCartridgeData(undefined);
        }
    }

    const selectRule = (newRule: RuleInfo|null) => {
        setRule(newRule);
        if (playing.isPlaying) replay();
    }

    async function uploadCartridge() {
        // replay({car});
        cartridgeFileRef.current?.click();
    }

    function handleOnChangeCartridgeUpload(e: any) {
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            if (playing.isPlaying) rivemuRef.current?.stop();
            setRuleList([]);
            setRule(undefined);
            setTape(new Uint8Array([]));
            setOutcard(undefined);
            setCartridgeData(undefined);
            setSelectedCartridge(undefined);
            const data = readerEvent.target?.result;
            if (data) {
                setStoredCartridge(false);
                setCartridgeData(new Uint8Array(data as ArrayBuffer));
            }
        };
        reader.readAsArrayBuffer(e.target.files[0])
    }
    

    async function uploadIncard() {
        // replay({car});
        incardFileRef.current?.click();
    }

    function handleOnChangeIncardUpload(e: any) {
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            if (playing.isPlaying) rivemuRef.current?.stop();
            const data = readerEvent.target?.result as ArrayBuffer;
            if (data) {
                const incard = new Uint8Array(data);
                setRuleIncard(incard);
                setRuleIncardHash(sha256(incard));
                setTape(new Uint8Array([]));
            }
        };
        reader.readAsArrayBuffer(e.target.files[0])
    }
    
    let decoder = new TextDecoder("utf-8");

    const rivemuOnFrame = function (
        outcard: ArrayBuffer,
        frame: number,
        cycles: number,
        fps: number,
        cpu_cost: number,
        cpu_speed: number,
        cpu_usage: number,
        cpu_quota: number
    ) {
        if (decoder.decode(outcard.slice(0,4)) == 'JSON' || decoder.decode(outcard.slice(0,4)) == 'TEXT') {
            const outcard_str = decoder.decode(outcard);
            setOutcard(outcard_str.substring(4));
        }
        if (decoder.decode(outcard.slice(0,4)) == 'JSON') {
            const outcard_str = decoder.decode(outcard);
            const outcard_json = JSON.parse(outcard_str.substring(4));
            if (ruleScoreFunction){
                try {
                    const parser = new Parser();
                    const scoreFunctionEvaluator = parser.parse(ruleScoreFunction);
                    setCurrScore(scoreFunctionEvaluator.evaluate(outcard_json));
                } catch (e) {
                    rivemuRef.current?.stop();
                    console.log(e);
                    setErrorFeedback({message:"Error parsing score", severity: "error", dismissible: true});
                }
            } else {
                setCurrScore(outcard_json.score);
            }
        }
    };

    const rivemuOnBegin = function (width: number, height: number, target_fps: number, total_frames: number) {
        console.log("rivemu_on_begin");
        setCurrScore(undefined);
        setOutcard(undefined);
        if (rule?.score_function) {
            setCurrScore(0);
        }
        setRestarting(false);
    };

    const rivemuOnFinish = function (
        rivlog: ArrayBuffer,
        outcard: ArrayBuffer,
        outhash: string
    ) {
        rivemuRef.current?.stop();
        console.log("rivemu_on_finish")
        // if (document.fullscreenElement) document.exitFullscreen();
        if (restarting)
            setPlaying({...playing, playCounter: playing.playCounter+1});
        else
            setPlaying({isPlaying: false, isReplay:false , playCounter: playing.playCounter+1});
        setTape(new Uint8Array(rivlog))
    };

    async function record() {
        setTape(new Uint8Array([]));
        setSpeed(1.0);
        setPaused(false);
        setRestarting(true);
        setPlaying({...playing, isPlaying: true, isReplay: false});
    }

    async function replay() {
        setSpeed(1.0);
        setPaused(false);
        setRestarting(true);
        setPlaying({...playing, isPlaying: true, isReplay: true});
        rivemuRef.current?.start();
    }

    async function pause() {
        if (paused){
            rivemuRef.current?.setSpeed(speed);
        } else {
            rivemuRef.current?.setSpeed(0);
        }
        setPaused(!paused);
    }

    async function rivemuChangeSpeed() {
        let newSpeed = 1.0;
        if (speed >= 4.0) {
            newSpeed = 0.5;
        } else if (speed >= 2.0) {
            newSpeed = 4.0;
        } else if (speed >= 1.5) {
            newSpeed = 2.0;
        } else if (speed >= 1) {
            newSpeed = 1.5;
        } else if (speed >= 0.5) {
            newSpeed = 1.0;
        }
        setSpeed(newSpeed);
        if (!paused) {
            await rivemuRef.current?.setSpeed(newSpeed);
        }
    }
      
    async function stop() {
        rivemuRef.current?.stop();
        setPlaying({...playing, isPlaying: false});
    }

    async function sendCartridge() {

        if (!cartridgeData) {
            setErrorFeedback({message:"No cartridge data", severity: "warning", dismissible: true});
            return;
        }

        if (storedCartridge) {
            setErrorFeedback({message:"Cartridge is already stored", severity: "warning", dismissible: true});
            return;
        }
        
        const out: CartridgeInfo = await cartridgeInfo(
            {id:sha256(cartridgeData)},
            {
                decode:true,
                cartesiNodeUrl: envClient.CARTESI_NODE_URL,
                cache:"force-cache"
            }
        );
        console.log(out)

        if (out) {
            setErrorFeedback({message:"Cartridge already inserted", severity: "warning", dismissible: true});
            return;
        }

        if (!wallet) {
            setErrorFeedback({message:"Please connect your wallet", severity: "warning", dismissible: true});
            return;
        }

        // submit the gameplay
        const signer = new ethers.providers.Web3Provider(wallet!.provider, 'any').getSigner();
        const inputData: InserCartridgePayload = {
            data: ethers.utils.hexlify(cartridgeData)
        }
        try {
            await insertCartridge(signer, envClient.DAPP_ADDR, inputData, {sync:false, cartesiNodeUrl: envClient.CARTESI_NODE_URL});
        } catch (error) {
            console.log(error)
            let errorMsg = (error as Error).message;
            if (errorMsg.toLowerCase().indexOf("user rejected") > -1) errorMsg = "User rejected tx";
            setErrorFeedback({message:errorMsg, severity: "error", dismissible: true});
            return;
        }
    }

    async function sendRule() {

        if (!cartridgeData) {
            setErrorFeedback({message:"No rule name", severity: "warning", dismissible: true});
            return;
        }
        const cartridgeId = sha256(cartridgeData);
        const out: CartridgeInfo = await cartridgeInfo(
            {id:cartridgeId},
            {
                cartesiNodeUrl: envClient.CARTESI_NODE_URL,
                cache:"force-cache"
            }
        );

        if (!out) {
            setErrorFeedback({message:"Cartridge not inserted yet", severity: "warning", dismissible: true});
            return;
        }

        if (!ruleName) {
            setErrorFeedback({message:"Invalid rule name", severity: "warning", dismissible: true});
            return;
        }

        const existingRules = await rules(
            {
                cartridge_id: cartridgeId, name: ruleName
            },
            {
                decode:true,
                decodeModel:"RulesOutput",
                cartesiNodeUrl: envClient.CARTESI_NODE_URL,
                cache:"force-cache"
            }
        );

        if (existingRules.total > 0) {
            setErrorFeedback({message:"Rule with this name already exists", severity: "warning", dismissible: true});
            return;
        }

        if (!wallet) {
            setErrorFeedback({message:"Please connect your wallet", severity: "warning", dismissible: true});
            return;
        }

        // submit the gameplay
        const signer = new ethers.providers.Web3Provider(wallet!.provider, 'any').getSigner();
        const inputData: RuleData = {
            cartridge_id:"0x"+cartridgeId,
            name:ruleName,
            description:ruleDescription||"",
            args:ruleArgs||"",
            score_function:ruleScoreFunction||"",
            in_card:ethers.utils.hexlify(ruleInCard||new Uint8Array([])),
            start:ruleStart?.unix() || 0,
            end:ruleEnd?.unix() || 0,
            tags:ruleTags||[]
        }
        try {
            await createRule(signer, envClient.DAPP_ADDR, inputData, {sync:false, cartesiNodeUrl: envClient.CARTESI_NODE_URL});
        } catch (error) {
            console.log(error)
            let errorMsg = (error as Error).message;
            if (errorMsg.toLowerCase().indexOf("user rejected") > -1) errorMsg = "User rejected tx";
            setErrorFeedback({message:errorMsg, severity: "error", dismissible: true});
            return;
        }
    }
    return (
        <ThemeProvider theme={darkTheme}>
        <CssBaseline />
            <main className="flex items-center flex-wrap justify-center h-[calc(100vh-8rem)] gap-2 overflow-auto absolute top-16 botom-16 w-full">
                <div className="grid grid-cols-1 place-items-center">
                    <div className='grid grid-cols-3 bg-gray-500 p-2 w-full'>
                        <div className="flex justify-start gap-2">
                            <button className="justify-self-start bg-gray-700 text-white border border-gray-700 hover:border-black"
                            title="Record"
                            disabled={!cartridgeData}
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={record}>
                                <FiberManualRecordIcon/>
                            </button>
                            <button className="justify-self-start bg-gray-700 text-white border border-gray-700 hover:border-black"
                            disabled={! cartridgeData || !tape || tape.length == 0}
                            title="Replay"
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={replay}>
                                <ReplayIcon/>
                            </button>
                            <button className="justify-self-start bg-gray-700 text-white border border-gray-700 hover:border-black"
                            disabled={!playing.isPlaying || !cartridgeData}
                            title="Pause/Resume"
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={pause}>
                                <PauseIcon/>
                            </button>
                            <button className="justify-self-end bg-red-500 text-white border border-gray-700 hover:border-black"
                            disabled={!playing.isPlaying || !cartridgeData}
                            title="Stop"
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={stop}
                            >
                                <StopIcon/>
                            </button>

                        </div>

                        <div>
                            { currScore == undefined ? <span>&emsp;</span> : <span>Score: {currScore}</span>}
                        </div>

                        <div className="flex justify-end gap-2">
                            <button className="justify-self-end bg-gray-700 text-white border border-gray-700 hover:border-black font-thin"
                            title="Change Speed"
                            disabled={!playing.isPlaying || !cartridgeData}
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={rivemuChangeSpeed}
                            >
                                <span>{speed.toFixed(1)}x</span>
                            </button>

                            <button className="justify-self-end bg-gray-700 text-white border border-gray-700 hover:border-black"
                            title="Fullscreen"
                            disabled={!playing.isPlaying || !cartridgeData}
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={rivemuRef.current?.fullScreen}
                            >
                                <FullscreenIcon/>
                            </button>

                            <button className="justify-self-end bg-gray-700 text-white border border-gray-700 hover:border-black"
                                title="Upload Cartridge" onClick={uploadCartridge}>
                                <UploadIcon/>
                            </button>
                        </div>

                    </div>
                    <div className='relative gameplay-screen' >
                        { !cartridgeData?
                            <div className={'absolute gameplay-screen text-white t-0 border border-gray-500 flex items-center justify-center'}>
                                <span>Select/upload cartridge</span>
                            </div>
                        : <></> }
                        <div hidden={!cartridgeData}  className={'absolute t-0'}>
                            <Rivemu ref={rivemuRef} cartridge_data={cartridgeData} args={ruleArgs} entropy={entropy}
                                tape={tape}
                                in_card={ruleInCard ? ruleInCard : new Uint8Array([])} 
                                rivemu_on_frame={rivemuOnFrame} rivemu_on_begin={rivemuOnBegin} rivemu_on_finish={rivemuOnFinish}
                            />
                        </div>
                    </div>
                    <TextField className="w-full" label="Outcard" disabled value={outcard || ""} variant="standard" hidden={!enableRuleEditing}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutcard(e.target.value)}/>
                    <input type="file" ref={cartridgeFileRef} onChange={(e) => handleOnChangeCartridgeUpload(e)} style={{ display: 'none' }}/>
                </div>
                <div className="grid grid-cols-1 gap-4 place-items-left text-white w-1/4">
                    <Autocomplete
                        value={selectedCartridge || null}
                        className="w-full"
                        options={cartridgeList}
                        onChange={(event: any, newValue: CartridgeInfo | null) => selectCartridge(newValue)}
                        open={cartridgesComboOpen}
                        onOpen={() => setCartridgesComboOpen(true)}
                        onClose={() => setCartridgesComboOpen(false)}
                        getOptionLabel={(option: CartridgeInfo) => option?.name}
                        renderInput={(params) => (
                            <TextField {...params} label="Cartridge" variant="standard"/>
                        )}
                    />

                    <Autocomplete
                        value={rule || null}
                        className="w-full"
                        options={ruleList}
                        open={rulesComboOpen}
                        onChange={(event: any, newValue: RuleInfo | null) => selectRule(newValue)}
                        onOpen={() => setRulesComboOpen(true)}
                        onClose={() => setRulesComboOpen(false)}
                        getOptionLabel={(option: RuleInfo) => option.name}
                        renderInput={(params) => (
                            <TextField label="Rule" {...params} variant="standard" />
                        )}
                    />
                    <FormControlLabel control={
                        <Switch value={enableRuleEditing} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableRuleEditing(!enableRuleEditing)}/>
                        } label="Rule Editing" />
                    <TextField className="w-full" label="Rule Name" value={ruleName || ""} variant="standard" hidden={!enableRuleEditing}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleName(e.target.value)} />
                    <TextField className="w-full" label="Rule Description" value={ruleDescription || ""} multiline variant="standard" hidden={!enableRuleEditing}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleDescription(e.target.value)} />
                    <TextField className="w-full" label="Rule Args" value={ruleArgs || ""} variant="standard" hidden={!enableRuleEditing}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleArgs(e.target.value)} />
                    <TextField className="w-full" label="Rule Score Function" value={ruleScoreFunction || ""} variant="standard" hidden={!enableRuleEditing}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleScoreFunction(e.target.value)} />

                    <FormControl variant="standard" hidden={!enableRuleEditing}>
                        <InputLabel htmlFor="incard">Rule Incard (Hash) <UploadIcon onClick={uploadIncard} className='cursor-pointer'/></InputLabel>
                        <Input id="incard" disabled value={ruleInCardHash || ""} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleIncardHash(e.target.value)} />
                    </FormControl>
                    <input type="file" ref={incardFileRef} onChange={(e) => handleOnChangeIncardUpload(e)} style={{ display: 'none' }}/>

                    <div hidden={!enableRuleEditing}><LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DateTimePicker label="Start (UTC)" value={ruleStart || null} onChange={(newValue: Dayjs | null) => setRuleStart(newValue||undefined)} />
                    </LocalizationProvider></div>

                    <div hidden={!enableRuleEditing}><LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DateTimePicker label="End (UTC)" value={ruleEnd || null} onChange={(newValue: Dayjs | null) => setRuleEnd(newValue||undefined)} defaultValue={null} />
                    </LocalizationProvider></div>

                    <Autocomplete
                        hidden={!enableRuleEditing}
                        multiple
                        value={ruleTags||[]}
                        defaultValue={[]}
                        id="tags-standard"
                        options={ruleCartridgeTags||[]}
                        getOptionLabel={(option) => option}
                        isOptionEqualToValue={(option, value) => option === value}
                        onChange={(event: any, newValue: string[] | null) => setRuleTags(newValue||undefined)}
                        filterOptions={(options, params) => {
                            const filtered = filter(options, params);

                            const { inputValue } = params;
                            // Suggest the creation of a new value
                            const isExisting = options.some((option) => inputValue === option);
                            if (inputValue !== '' && !isExisting) {
                                filtered.push(`"${inputValue}"`);
                            }

                            return filtered;
                        }}
                        renderInput={(params) => (
                        <TextField
                            {...params}
                            variant="standard"
                            label="Tags"
                        />
                        )}
                        renderTags={(tagValue, getTagProps) => {
                          return tagValue.map((option, index) => (
                            <Chip {...getTagProps({ index })} key={option} label={option} />
                          ))
                        }}
                    />
                    
                    <FormControlLabel 
                        hidden={true} // TODO: get info from cartridge data and remove this hidden
                        control={
                            <Switch value={showCartridgeInfo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowCartridgeInfo(!showCartridgeInfo)}/>
                        } label="Show Cartridge Info" />
                    <TextField className="w-full" label="Cartridge Info Name" disabled value={infoCartridge?.name || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Summary" disabled value={infoCartridge?.summary || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Description" disabled value={infoCartridge?.description || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Authors" disabled value={`${infoCartridge?.authors}` || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Status" disabled value={infoCartridge?.status || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Url" disabled value={infoCartridge?.url || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Tags" disabled value={`${infoCartridge?.tags}` || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />
                    <TextField className="w-full" label="Cartridge Info Version" disabled value={infoCartridge?.version || ""} variant="standard" hidden={!showCartridgeInfo}
                         InputLabelProps={{ shrink: true }} />

                    <div className='grid grid-cols-2 gap-2 justify-items-center'>
                    <button disabled={!cartridgeData || storedCartridge || !wallet} className="btn mt-2 text-[10px] shadow" onClick={sendCartridge}>
                        Insert Cartridge
                    </button>

                    <button disabled={!ruleName || !wallet} className="btn mt-2 text-[10px] shadow" onClick={sendRule} hidden={!enableRuleEditing}>
                        Create Rule
                    </button>
                    </div>
                </div>

            {errorFeedback ? <ErrorModal error={errorFeedback} dissmissFunction={() => {setErrorFeedback(undefined)}} /> : <></>}
            </main>
        </ThemeProvider>
    )
}

export default RivemuEditor