"use client"


import { ethers } from "ethers";
import React, { useContext, useState, useEffect, cache } from 'react'
import Script from "next/script";
import Image from 'next/image';
import {Expression, Parser} from 'expr-eval';
import CloseIcon from '@mui/icons-material/Close';
import RestartIcon from '@mui/icons-material/RestartAlt';
import StopIcon from '@mui/icons-material/Stop';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { sha256 } from "js-sha256";
// import * as GIFEncoder from 'gif-encoder-2';

import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { cartridge } from '../backend-libs/core/lib';
import { envClient } from '../utils/clientEnv';
import { useConnectWallet } from '@web3-onboard/react';

const LAST_FRAMES_SIZE = 20;
const LAST_FRAME_FREQ = 4; // get freq frames per second

enum RIVEMU_STATE {
    WAITING,
    PLAY_READY,
    PLAYING,
    REPLAY_READY,
    REPLAYING
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

function Rivemu() {
    const {selectedCartridge, setCartridgeData, setGameplay, stopCartridge, setDownloadingCartridge } = useContext(selectedCartridgeContext);
    const [overallScore, setOverallScore] = useState<number>();

    const [cancelled, setCancelled] = useState(false);

    const [runtimeInitialized, setRuntimeInitialized] = useState(false);
    const [playedOnce, setPlayedOnce] = useState(false);
    const [freshOpen, setFreshOpen] = useState(true);
    const [rivemuState, setRivemuState] = useState(RIVEMU_STATE.WAITING);

    const [signerAddress,setSignerAddress] = useState<String>();

    const [scoreFunction,setScoreFunction] = useState<Expression>();

    const [lastFrameIndex, setLastFrameIndex] = useState<number>();
    const [lastFrames,setLastFrames] = useState<string[]>([])

    const [{ wallet }, connect] = useConnectWallet();

    const [cartridgeWidth, setCartridgeWidth] = useState<number>();
    const [cartridgeHeight, setCartridgeHeight] = useState<number>();
    useEffect(() => {
        if (!selectedCartridge || !selectedCartridge?.play) return;

        // start game if there is a Cartridge selected and the user clicked "PLAY" on CartridgeInfo
        initialize().then(() => setRivemuState(RIVEMU_STATE.PLAY_READY));
    }
    ,[selectedCartridge?.play])

    useEffect(() => {
        if (!selectedCartridge || !selectedCartridge.replay) return;

        initialize().then(() => setRivemuState(RIVEMU_STATE.REPLAY_READY));
    }, [selectedCartridge?.replay])

    useEffect(() => {
        if (cancelled) {
            setRivemuState(RIVEMU_STATE.WAITING);
            rivemuHalt();
            setOverallScore(undefined);
            stopCartridge();
        }
    }, [cancelled])

    useEffect(() => {
        if (rivemuState == RIVEMU_STATE.PLAY_READY) {
            rivemuStart();
        } else if (rivemuState == RIVEMU_STATE.REPLAY_READY) {
            rivemuReplay();
        }
    }, [rivemuState])

    useEffect(() => {
        if (!wallet) {
            setSignerAddress(undefined);
            if (rivemuState == RIVEMU_STATE.PLAYING) {
                rivemuRestart();
            }
            return;
        }
        const curSigner = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
        curSigner.getAddress().then((a: String) => {
            setSignerAddress(a.toLowerCase());
            if (rivemuState == RIVEMU_STATE.PLAYING) {
                rivemuRestart();
            }
        });
    },[wallet]);

    // useEffect(() => {
    //     interface keyboardEvent {key:string}
    //     const escPressed = (event: keyboardEvent) => {
    //         console.log(event, isPlaying);
    //         if (event.key === "Escape" && !isPlaying) {
    //             stopCartridge();
    //         }
    //     }

    //     document.addEventListener("keydown", escPressed);

    // })

    async function initialize() {
        await loadCartridge();
        if (cancelled) setCancelled(false);
        setFreshOpen(true);
    }

    async function loadCartridge() {
        if (!selectedCartridge || !(selectedCartridge.play || selectedCartridge.replay) || selectedCartridge.cartridgeData != undefined) return;
        setDownloadingCartridge(true);
        const data = await cartridge({id:selectedCartridge.id},{decode:true,decodeModel:"bytes", cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"});
        setCartridgeData(data); // setCartridgeData also sets downloading to false
    }

    if (!selectedCartridge) {
        return  <></>;
    }

    var decoder = new TextDecoder("utf-8");
    let parser = new Parser();

    function coverFallback() {
        return (
            <button className='relative h-full w-full' onClick={!selectedCartridge?.replay ? rivemuStart : rivemuReplay}>
                {freshOpen ? <Image alt={"Cover " + selectedCartridge?.name}
                id="canvas-cover"
                layout='fill'
                objectFit='contain'
                style={{
                    imageRendering: "pixelated"
                }}
                src={selectedCartridge?.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/logo.png"}
                /> : <></>}

                <span className='absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white'
                    style={{backgroundColor: "#8b5cf6", padding: "10px"}}>Click to {!selectedCartridge?.replay ? "Play" : "Replay"}!</span>

            </button>
        );
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

    async function rivemuStart() {
        if (!selectedCartridge?.cartridgeData) return;
        console.log("rivemuStart");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuInitialize();
        await rivemuHalt();
        setRivemuState(RIVEMU_STATE.PLAYING);
        setOverallScore(undefined);
        lastFrames.splice(0,lastFrames.length);
        setLastFrames(lastFrames);
        setLastFrameIndex(undefined);

        if (selectedCartridge.scoreFunction) {
            setOverallScore(0);
            setScoreFunction(parser.parse(selectedCartridge.scoreFunction));
        }

        // @ts-ignore:next-line
        let buf = Module._malloc(selectedCartridge.cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.cartridgeData, buf);
        const inCard = selectedCartridge?.inCard || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        let params = selectedCartridge?.args || "";
        // entropy
        let entropy = "";
        if (signerAddress) {
            entropy = generateEntropy(signerAddress,selectedCartridge.rule);
            if (entropy.length == 0) {
                alert("Invalid entropy");
                return;
            }
        }
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_record",
            null,
            ['number', 'number', 'number', 'number', 'string', 'string'],
            [
                buf,
                selectedCartridge.cartridgeData.length,
                incardBuf,
                selectedCartridge.inCard?.length || 0,
                entropy,
                params || ''
            ]
        );
        // @ts-ignore:next-line
        Module._free(buf);
        // @ts-ignore:next-line
        Module._free(incardBuf);
    }

    async function rivemuReplay() {
        // TODO: fix rivemuReplay
        if (!selectedCartridge?.cartridgeData || !selectedCartridge?.replay) return;
        console.log("rivemuReplay");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuInitialize();
        await rivemuHalt();
        setRivemuState(RIVEMU_STATE.REPLAYING);
        setOverallScore(undefined);
        lastFrames.splice(0,lastFrames.length);
        setLastFrames(lastFrames);
        setLastFrameIndex(undefined);

        if (selectedCartridge.scoreFunction) {
            setOverallScore(0);
            setScoreFunction(parser.parse(selectedCartridge.scoreFunction));
        }

        // @ts-ignore:next-line
        const cartridgeBuf = Module._malloc(selectedCartridge.cartridgeData.length);
        // @ts-ignore:next-line
        const rivlogBuf = Module._malloc(selectedCartridge.replay.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.cartridgeData, cartridgeBuf);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.replay, rivlogBuf);
        const inCard = selectedCartridge?.inCard || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        // entropy
        const entropy = generateEntropy(selectedCartridge.replayUserAddress,selectedCartridge.replayRule);
        if (entropy.length == 0) {
            alert("Invalid entropy");
            return;
        }
        const params = selectedCartridge?.args || "";
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_replay",
            null,
            ['number', 'number', 'number', 'number', 'string', 'string', 'number', 'number'],
            [
                cartridgeBuf,
                selectedCartridge.cartridgeData.length,
                incardBuf,
                inCard.length,
                entropy,
                params,
                rivlogBuf,
                selectedCartridge.replay.length
            ]
        );
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
        // @ts-ignore:next-line
        Module._free(rivlogBuf);
        // @ts-ignore:next-line
        Module._free(incardBuf);
    }

    async function rivemuInitialize() {
        if (!runtimeInitialized) {
            // @ts-ignore:next-line
            if (typeof Module == "undefined" || typeof Module._rivemu_stop == "undefined")
                await waitEvent("rivemu_on_runtime_initialized");
            setRuntimeInitialized(true);
        }
    }

    async function rivemuHalt() {
        // @ts-ignore:next-line
        if (Module.ccall('rivemu_stop')) {
            await waitEvent('rivemu_on_shutdown');
        }
    }

    async function rivemuStop() {
        console.log("rivemuStop");
        rivemuHalt();
        // stopCartridge();
    }

    function rivemuFullscreen() {
        const canvas: any = document.getElementById("canvas");
        if (canvas) {
            canvas.requestFullscreen();
        }
    }

    function rivemuRestart() {
        // set state to WAITING to prevent gameplayLog from being saved and submit gameplay prompt
        setRivemuState(RIVEMU_STATE.WAITING);
        rivemuStart();
    }

    async function close() {
        if (selectedCartridge?.downloading) return;
        setCancelled(true);
    }

    // function createGif() {
    //     if (selectedCartridge?.downloading) return;
    //     setCancelled(true);
    // }

    if (typeof window !== "undefined") {
        // @ts-ignore:next-line
        window.rivemu_on_frame = function (
            outcard: ArrayBuffer,
            frame: number,
            cycles: number,
            fps: number,
            cpu_cost: number,
            cpu_speed: number,
            cpu_usage: number,
            cpu_quota: number
        ) {
            if (decoder.decode(outcard.slice(0,4)) == 'JSON') {
                const outcard_str = decoder.decode(outcard);
                const outcard_json = JSON.parse(outcard_str.substring(4));
                if (selectedCartridge?.scoreFunction && scoreFunction) {
                    const score = scoreFunction.evaluate(outcard_json);
                    setOverallScore(score);
                }
            }
            
            const canvas = document.getElementById("canvas");
            if (canvas) {
                if (lastFrameIndex == undefined || frame >= lastFrameIndex + fps/LAST_FRAME_FREQ) {
                    const frameImage = (canvas as HTMLCanvasElement).toDataURL('image/jpeg');
                    if (lastFrames.push(frameImage) > LAST_FRAMES_SIZE) {
                        lastFrames.splice(0,1);
                    }
                    setLastFrameIndex(frame);
                    setLastFrames(lastFrames);
                }
            }
        };

        // @ts-ignore:next-line
        window.rivemu_on_begin = function (width: number, height: number, target_fps: number, total_frames: number) {
            if (!playedOnce) setPlayedOnce(true);
            if (freshOpen) setFreshOpen(false);
            console.log("rivemu_on_begin");
            setCartridgeHeight(height);
            setCartridgeWidth(width);
        };

        // @ts-ignore:next-line
        window.rivemu_on_finish = function (
            rivlog: ArrayBuffer,
            outcard: ArrayBuffer,
            outhash: string
        ) {
            if (wallet) {
                if (rivemuState === RIVEMU_STATE.PLAYING && !cancelled) {
                    let score: number | undefined = undefined;
                    if (decoder.decode(outcard.slice(0,4)) == 'JSON' && selectedCartridge?.scoreFunction && scoreFunction) {
                        const outcard_str = decoder.decode(outcard);
                        const outcard_json = JSON.parse(outcard_str.substring(4));
                        score = scoreFunction.evaluate(outcard_json);
                    }
                    setGameplay(new Uint8Array(rivlog),new Uint8Array(outcard),outhash,score,lastFrames,cartridgeHeight,cartridgeWidth);
                }
            }
            rivemuStop();
            setRivemuState(RIVEMU_STATE.WAITING);
            console.log("rivemu_on_finish")
        };
    }


    return (
        <div hidden={selectedCartridge?.cartridgeData==undefined || !selectedCartridge.initCanvas}>
        <section className='gameplay-section' >
            <div className='relative bg-gray-500 p-2 text-center'>
                <button className="bg-gray-700 text-white absolute top-1 start-2.5 border border-gray-700 hover:border-black"
                    onKeyDown={() => null} onKeyUp={() => null}
                    onClick={() => {rivemuState === RIVEMU_STATE.PLAYING? rivemuRestart():rivemuReplay()}}>
                    <RestartIcon/>
                </button>
                {
                    rivemuState !== RIVEMU_STATE.PLAYING?
                        <></>
                    :
                        // onKeyDown and onKeyUp "null" prevent buttons pressed when playing to trigger "rivemuStop"
                        <button className="bg-gray-700 text-white absolute top-1 start-10 border border-gray-700 hover:border-black"
                            onKeyDown={() => null} onKeyUp={() => null}
                            onClick={rivemuStop}>
                            <StopIcon/>
                        </button>
                }

                {!selectedCartridge.rule && !selectedCartridge.replayRule ? <></> : overallScore == undefined ? <span>no score</span> : <span>Score: {overallScore}</span>}

                <button className="bg-gray-700 text-white absolute top-1 end-10 border border-gray-700 hover:border-black"
                    hidden={rivemuState === RIVEMU_STATE.WAITING}
                    onKeyDown={() => null} onKeyUp={() => null}
                    onClick={rivemuFullscreen}>
                    <FullscreenIcon/>
                </button>

                <button className="bg-gray-700 text-white absolute top-1 end-2.5 border border-gray-700 hover:border-black"
                    onKeyDown={() => null} onKeyUp={() => null}
                    onClick={close}
                >
                    <CloseIcon/>
                </button>
            </div>

            <div className='bg-black max-h-full max-w-full'
                >
                <div className='flex justify-center gameplay-screen max-h-full max-w-full'>
                    <canvas
                        className='max-h-full max-w-full'
                        id="canvas"
                        height={768}
                        width={768}
                        onContextMenu={(e) => e.preventDefault()}
                        tabIndex={-1}
                        style={{
                            imageRendering: "pixelated",
                            objectFit: "contain"
                        }}
                    />
                </div>

                <div hidden={rivemuState !== RIVEMU_STATE.WAITING} className='absolute top-[40px] gameplay-screen'>
                    {coverFallback()}
                </div>
            </div>
            <div className='relative bg-gray-500 p-2 text-center'>
                {wallet ? <></> : <span>Free play (no wallet connected)</span> }
            </div>
            <Script src="/rivemu.js?" strategy="lazyOnload" />
            <Script src="/initializeRivemu.js?" strategy="lazyOnload" />
        </section>
        <div className="opacity-60 absolute inset-0 z-0 bg-black" onClick={() => close()}></div>
        </div>
    )
}

export default Rivemu