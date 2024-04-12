"use client"

import { Parser } from "expr-eval";
import { ethers } from "ethers";
import Script from "next/script"
import { useContext, useState, useEffect } from "react";
import { useConnectWallet } from '@web3-onboard/react';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import { gameplayContext } from "../play/GameplayContextProvider";


function RivemuPlayer(
{cartridgeData, cartridge_id, rule_id, args, in_card, scoreFunction, userAddress, tape}:
{cartridgeData:Uint8Array, cartridge_id: string, rule_id?:string, args?:string, in_card?:Uint8Array, scoreFunction?:string, userAddress?:string, tape?:Uint8Array}) {
    const {setGameplayLog} = useContext(gameplayContext);

    const isTape = tape? true:false;

    // rivemu state
    const [currScore, setCurrScore] = useState<number>();
    const [playing, setPlaying] = useState({isPlaying: false, playCounter: 0})

    // signer
    const [signerAddress,setSignerAddress] = useState<String>();
    const [{ wallet }, connect] = useConnectWallet();

    useEffect(() => {
        if (!wallet) {
            setSignerAddress(undefined);
            if (!isTape && playing.isPlaying) {
                rivemuStart();
            }
            return;
        }
        const curSigner = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
        curSigner.getAddress().then((a: String) => {
            setSignerAddress(a.toLowerCase());
            if (!isTape && playing.isPlaying) {
                rivemuStart();
            }
        });
    },[wallet]);


    if (isTape && (!userAddress || userAddress.length != 42)) {
        return (
            <span className="flex items-center justify-center h-lvh text-white">
                Missing user address from tape...
            </span>
        )
    }
    
    const parser = new Parser();
    const scoreFunctionEvaluator = scoreFunction? parser.parse(scoreFunction):null;
    
    // BEGIN: rivemu
    async function rivemuStart() {
        if (cartridgeData.length == 0) return;
        console.log("rivemuStart");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuHalt();
        setCurrScore(undefined);
        if (scoreFunction) {
            setCurrScore(0);
        }

        // @ts-ignore:next-line
        let cartridgeBuf = Module._malloc(cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(cartridgeData, cartridgeBuf);
        const inCard = new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = "";
        // TODO: Add singner address to entropy
        // params = `${params} -entropy ${signerAddress}`;
        console.log(
            "rivemu_start_record",
            null,
            ['number', 'number', 'number', 'number', 'string'],
            [
                cartridgeBuf,
                cartridgeData.length,
                incardBuf,
                inCard.length,
                params
            ])
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_record",
            null,
            ['number', 'number', 'number', 'number', 'string'],
            [
                cartridgeBuf,
                cartridgeData.length,
                incardBuf,
                inCard.length,
                params
            ]
        );
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
        // @ts-ignore:next-line
        Module._free(incardBuf);
    }


    async function rivemuReplay() {
        // TODO: fix rivemuReplay
        if (!cartridgeData || !tape) return;
        console.log("rivemuReplay");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuHalt();
        setCurrScore(undefined);
        if (scoreFunction) {
            setCurrScore(0);
        }

        // @ts-ignore:next-line
        const cartridgeBuf = Module._malloc(cartridgeData.length);
        // @ts-ignore:next-line
        const rivlogBuf = Module._malloc(tape.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(cartridgeData, cartridgeBuf);
        // @ts-ignore:next-line
        Module.HEAPU8.set(tape, rivlogBuf);
        const inCard = in_card || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = args || "";
        // TODO: Add singner address to entropy
        // params = `${params} -entropy ${userAddress}`;
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_replay",
            null,
            ['number', 'number', 'number', 'number', 'string', 'number', 'number'],
            [
                cartridgeBuf,
                cartridgeData.length,
                incardBuf,
                inCard.length,
                params,
                rivlogBuf,
                tape.length
            ]
        );
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
        // @ts-ignore:next-line
        Module._free(rivlogBuf);
        // @ts-ignore:next-line
        Module._free(incardBuf);
    }

    async function rivemuHalt() {
        // @ts-ignore:next-line
        if (Module.ccall('rivemu_stop')) {
            await waitEvent('rivemu_on_shutdown');
        }
    }
    
    function waitEvent(name: string) {
        return new Promise((resolve) => {
            const listener = (e: any) => {
                window.removeEventListener(name, listener);
                resolve(e);
            }
            window.addEventListener(name, listener);
        })
    }

    async function rivemuStop() {
        console.log("rivemuStop");
        rivemuHalt();
    }

    if (typeof window !== "undefined") {
        let decoder = new TextDecoder("utf-8");
        let parser = new Parser();
    
        // @ts-ignore:next-line
        window.rivemu_on_frame = function (
            outcard: ArrayBuffer,
            frame: number,
            fps: number,
            mips: number,
            cpu_usage: number,
            cycles: number
        ) {
            if (scoreFunctionEvaluator && decoder.decode(outcard.slice(0,4)) == 'JSON') {
                const outcard_str = decoder.decode(outcard);
                const outcard_json = JSON.parse(outcard_str.substring(4));
                setCurrScore(scoreFunctionEvaluator.evaluate(outcard_json));
            }
        };

        // @ts-ignore:next-line
        window.rivemu_on_begin = function (width: number, height: number, target_fps: number, total_frames: number) {
            console.log("rivemu_on_begin");
        };

        // @ts-ignore:next-line
        window.rivemu_on_finish = function (
            rivlog: ArrayBuffer,
            outcard: ArrayBuffer,
            outhash: string
        ) {
            rivemuStop();
            console.log("rivemu_on_finish")
            if (!isTape && rule_id && signerAddress) {
                let score: number | undefined = undefined;
                if (scoreFunctionEvaluator && decoder.decode(outcard.slice(0,4)) == 'JSON') {
                    const outcard_str = decoder.decode(outcard);
                    const outcard_json = JSON.parse(outcard_str.substring(4));
                    score = scoreFunctionEvaluator.evaluate(outcard_json);
                }
                setGameplayLog(
                    {
                        cartridge_id,
                        log: new Uint8Array(rivlog),
                        outcard: {
                            value: new Uint8Array(outcard),
                            hash: outhash
                        },
                        score,
                        rule_id
                    }
                );
                // TODO: submit tape
            }
            setPlaying({isPlaying: false, playCounter: playing.playCounter+1})
        };
    }
    // END: rivemu

    function playTape() {
        setPlaying({...playing, isPlaying: true});
        rivemuReplay();
    }

    function playGame() {
        setPlaying({...playing, isPlaying: true});
        rivemuStart();
    }

    return (
        <main className="flex items-center justify-center">
            <section className="grid grid-cols-1 gap-4 place-items-center">
                <div className="relative">
                {
                    !playing.isPlaying?
                        <button className={'absolute gameplay-screen text-gray-500 hover:text-white t-0 backdrop-blur-sm ' + (playing.playCounter == 0 ? 'border' : '')} onClick={isTape? playTape: playGame}>
                            {
                                playing.playCounter === 0?
                                    <PlayArrowIcon className='text-7xl'/>
                                :
                                    <ReplayIcon className='text-7xl'/>
                            }
                            
                        </button>
                    : <></> }
                        <canvas
                            className='gameplay-screen t-0'
                            id="canvas"
                            onContextMenu={(e) => e.preventDefault()}
                            tabIndex={-1}
                            style={{
                                imageRendering: "pixelated",
                                objectFit: "contain"
                            }}
                        />
                    </div>
                {!isTape && rule_id && !playing.isPlaying && playing.playCounter > 0 ? <button className="btn" onClick={() => {alert("submit tape")}} disabled={signerAddress == undefined}>
                  <span>Verify Tape {signerAddress ? "" : " (wallet not connected)"}</span><br/>
                </button> : <></>}
            </section>
            <Script src="/rivemu.js?" strategy="lazyOnload" />
        </main>
    )
}

export default RivemuPlayer