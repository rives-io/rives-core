"use client"


import React, { useContext, useState, useEffect, cache } from 'react'
import Script from "next/script";
import Image from 'next/image';
import {Parser} from 'expr-eval';
import CloseIcon from '@mui/icons-material/Close';

import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { cartridge } from '../backend-libs/app/lib';
import { envClient } from '../utils/clientEnv';

const canvasMinHeight = 400;
const canvasMinWidth = 640;

function Rivemu() {
    const {selectedCartridge, setCartridgeData, setGameplay, stopCartridge, setDownloadingCartridge } = useContext(selectedCartridgeContext);
    const [overallScore, setOverallScore] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    // const [replayTip, setReplayTip] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [cancelled, setCancelled] = useState(false);
    // const [isExpanded, setIsExpanded] = useState(false);
    const [playedOnce, setPlayedOnce] = useState(false);
    const [replayLog, setReplayLog] = useState<Uint8Array|undefined>(undefined);
    const [freshOpen, setFreshOpen] = useState(true);

    useEffect(() => {
        if (!selectedCartridge || !selectedCartridge?.play) return;
        initialize();
    }
    ,[selectedCartridge?.playToggle, selectedCartridge?.replay])

    useEffect(() => {
        if (!isPlaying) {
            rivemuReplay();
        }
    }, [replayLog])

    useEffect(() => {
        if (cancelled) {
            setIsPlaying(false);
            rivemuHalt();
            setOverallScore(0);
            stopCartridge();
        }
    }, [cancelled])

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
        if (!selectedCartridge || selectedCartridge.cartridgeData == undefined) {
            setIsPlaying(false);
            // setIsExpanded(false);
            setOverallScore(0);
            setReplayLog(undefined);
        }
        await loadCartridge();
        setCancelled(false);
        setFreshOpen(true);
        if (selectedCartridge?.replay){
            setReplayLog(selectedCartridge.replay);
            setIsReplaying(true);
            // setReplayTip(true);
        }
        if (selectedCartridge?.gameplayLog) {
            setReplayLog(selectedCartridge.gameplayLog);
            setIsReplaying(false);
            // setReplayTip(true);
        }
    }

    async function loadCartridge() {
        if (!selectedCartridge || !selectedCartridge?.play || selectedCartridge.cartridgeData != undefined) return;
        setDownloadingCartridge(true);
        const data = await cartridge({id:selectedCartridge.id},{decode:true,decodeModel:"bytes", cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"});
        setCartridgeData(data); // setCartridgeData also sets downloading to false
    }

    if (!selectedCartridge || !selectedCartridge.initCanvas) {
        return  <></>;
    }

    var decoder = new TextDecoder("utf-8");
    let parser = new Parser();
    let scoreFunction = parser.parse('score');

    function coverFallback() {
        return (
            <button className='relative h-full w-full' onClick={rivemuStart}>
                {freshOpen ? <Image alt={"Cover " + selectedCartridge?.name}
                id="canvas-cover"
                layout='fill'
                objectFit='contain'
                src={selectedCartridge?.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/logo.png"}
                /> : <></>}

                <span className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white'>Click to Play!</span>

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
        // setIsLoading(true);
        setIsReplaying(false);
        // setReplayTip(false);
        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuHalt();
        setIsPlaying(true);
        setOverallScore(0);

        if (selectedCartridge.scoreFunction)
            scoreFunction = parser.parse(selectedCartridge.scoreFunction);
        // @ts-ignore:next-line
        let buf = Module._malloc(selectedCartridge.cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.cartridgeData, buf);
        const inCard = selectedCartridge?.inCard || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = selectedCartridge?.args || "";
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_record",
            null,
            ['number', 'number', 'number', 'number', 'string'],
            [
                buf,
                selectedCartridge.cartridgeData.length,
                incardBuf,
                selectedCartridge.inCard?.length || 0,
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
        if (!selectedCartridge?.cartridgeData || !replayLog) return;
        console.log("rivemuReplay");

        // setReplayTip(false);
        // if (selectedCartridge.cartridgeData == undefined || selectedCartridge.outcard != undefined || selectedCartridge.outhash != undefined)
        //     setIsReplaying(true);

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuHalt();
        setIsPlaying(true);
        setOverallScore(0);

        if (selectedCartridge.scoreFunction)
            scoreFunction = parser.parse(selectedCartridge.scoreFunction);
        // @ts-ignore:next-line
        const cartridgeBuf = Module._malloc(selectedCartridge.cartridgeData.length);
        // @ts-ignore:next-line
        const rivlogBuf = Module._malloc(replayLog.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.cartridgeData, cartridgeBuf);
        // @ts-ignore:next-line
        Module.HEAPU8.set(replayLog, rivlogBuf);
        const inCard = selectedCartridge?.inCard || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = selectedCartridge?.args || "";
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_replay",
            null,
            ['number', 'number', 'number', 'number', 'string', 'number', 'number'],
            [
                cartridgeBuf,
                selectedCartridge.cartridgeData.length,
                incardBuf,
                inCard.length,
                params,
                rivlogBuf,
                replayLog.length
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

    async function rivemuStop() {
        console.log("rivemuStop");
        setIsPlaying(false);
        rivemuHalt();
        // stopCartridge();
    }

    async function close() {
        if (selectedCartridge?.downloading) return;
        setCancelled(true);
    }


    if (typeof window !== "undefined") {
        // @ts-ignore:next-line
        window.rivemu_on_frame = function (
            outcard: ArrayBuffer,
            frame: number,
            fps: number,
            mips: number,
            cpu_usage: number,
            cycles: number
        ) {
            let score = 0;
            if (decoder.decode(outcard.slice(0,4)) == 'JSON') {
                const outcard_str = decoder.decode(outcard);
                const outcard_json = JSON.parse(outcard_str.substring(4));
                score = outcard_json.score;
                if (selectedCartridge?.scoreFunction) {
                    score = scoreFunction.evaluate(outcard_json);
                }
            }
            setOverallScore(score);
        };

        // @ts-ignore:next-line
        window.rivemu_on_begin = function (width: number, height: number, target_fps: number, total_frames: number) {
            if (!playedOnce) setPlayedOnce(true);
            if (freshOpen) setFreshOpen(false);
            // const canvas: any = document.getElementById("canvas");
            // const maxCanvasHeight = canvas.parentElement.clientHeight;
            // const maxCanvasWidth = canvas.parentElement.clientWidth;
            // if (canvas) {
            //     canvas.height = maxCanvasHeight;
            //     canvas.width = maxCanvasWidth;
            // }
            console.log("rivemu_on_begin");
            // force canvas resize
            // window.dispatchEvent(new Event("resize"));
        };

        // @ts-ignore:next-line
        window.rivemu_on_finish = function (
            rivlog: ArrayBuffer,
            outcard: ArrayBuffer,
            outhash: string
        ) {
            if (!isReplaying && !cancelled) {
                setGameplay(new Uint8Array(rivlog),new Uint8Array(outcard),outhash);
                // setReplayLog(new Uint8Array(rivlog));
            }
            rivemuStop();
            console.log("rivemu_on_finish")
        };
    }


    return (
        <div>
        <section className='gameplay-section' hidden={selectedCartridge?.cartridgeData==undefined}>
            <div className='relative bg-gray-500 p-2 text-center'>
                <span>Score: {overallScore}</span>
                <button className="absolute top-1 end-2.5 rounded border border-gray-500 hover:border-black"
                onClick={() => close()}
                >
                    <CloseIcon/>
                </button>
            </div>

            <div className='bg-black max-h-full max-w-full'
                >
                <div hidden={!isPlaying && playedOnce} className='flex justify-center gameplay-screen max-h-full max-w-full'>
                    <canvas
                        className='max-h-full max-w-full'
                        id="canvas"
                        height={canvasMinHeight}
                        width={canvasMinWidth}
                        onContextMenu={(e) => e.preventDefault()}
                        tabIndex={-1}
                        style={{
                            minHeight: canvasMinHeight,
                            minWidth: canvasMinWidth
                        }}
                    />
                </div>

                <div hidden={isPlaying} className='absolute top-[40px] gameplay-screen'>
                    {coverFallback()}
                </div>
            </div>

            <div className='text-center d-flex space-x-1 justify-content-center mt-4'>
                {
                    !isPlaying?
                        <button className='btn' onClick={rivemuStart}>
                            Start
                        </button>
                    :
                        // onKeyDown and onKeyUp "null" prevent buttons pressed when playing to trigger "rivemuStop"
                        <button className='btn' onKeyDown={() => null} onKeyUp={() => null} onClick={rivemuStop}>
                            Stop
                        </button>
                }

            </div>
            <Script src="/rivemu.js?" strategy="lazyOnload" />
        </section>
        <div className="opacity-60 fixed inset-0 z-0 bg-black" onClick={() => close()}></div>
        </div>
    )
}

export default Rivemu