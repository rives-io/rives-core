"use client"


import React, { useContext, useState, useEffect, Suspense } from 'react'
import Script from "next/script";
import Image from 'next/image';
import {Parser} from 'expr-eval';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Stop from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { cartridge } from '../backend-libs/app/lib';
import { fontPressStart2P } from '../utils/font';
import { envClient } from '../utils/clientEnv';
import { delay, usePrevious } from '../utils/util';

// let rivlogData: Uint8Array | undefined = undefined;

async function movePageToBottom() {
    await delay(500);
    window.scrollTo({left: 0, top: document.body.scrollHeight, behavior: 'smooth'});
}

async function movePageToTop() {
    await delay(500);
    window.scrollTo({left: 0, top: 0, behavior: 'smooth'});
}

function getWindowDimensions() {
    const { innerWidth: width, innerHeight: height } = window;
    return { width, height };
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGTH = 400;

function Rivemu() {
    const {selectedCartridge, setCartridgeData, setGameplay } = useContext(selectedCartridgeContext);
    const [overallScore, setOverallScore] = useState(0);
    // const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [replayTip, setReplayTip] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [playedOnce, setPlayedOnce] = useState(false);
    const [canvasHeight, setCanvasHeight] = useState(DEFAULT_HEIGTH);
    const [descHeight, setDescHeight] = useState(100);
    const [canvasWidth, setCanvasWidth] = useState(DEFAULT_WIDTH);
    const [replayLog, setReplayLog] = useState<Uint8Array|undefined>(undefined);
    const [gameHeigth, setGameHeigth] = useState(0);

    useEffect(()=>{
        if (!selectedCartridge || !selectedCartridge?.play) return;
        initialize();
    }
    ,[selectedCartridge?.playToggle])

    useEffect(()=>{
        let newHeight = DEFAULT_HEIGTH;
        let newWidth = DEFAULT_WIDTH;
        const canvas: any = document.getElementById("canvas");
        if (canvas) {
            const aspectRatio = canvas ? canvas.width / canvas.height : 640/400;
            if (isExpanded) {
                const windowSizes = getWindowDimensions();
                newHeight = windowSizes.height - 120;
                newWidth = Math.floor(aspectRatio * newHeight);
                if (newWidth > windowSizes.width - 10) {
                    newWidth = windowSizes.height - 10;
                    newHeight = Math.floor(newWidth / aspectRatio);
                }
            }

            canvas.height = Math.floor(newHeight / gameHeigth) * gameHeigth;
            canvas.width = Math.floor(aspectRatio * canvas.height);
        }
        setCanvasHeight(newHeight);
        setCanvasWidth(newWidth);
        window.dispatchEvent(new Event("resize"));
        movePageToBottom();
    }
    ,[isExpanded])

    async function initialize() {
        if (!selectedCartridge || selectedCartridge.cartridgeData == undefined) {
            setGameHeigth(0);
            setCanvasHeight(DEFAULT_HEIGTH);
            setCanvasWidth(DEFAULT_WIDTH);
            setIsPlaying(false);
            setIsExpanded(false);
            setOverallScore(0);
            setReplayLog(undefined);
            const windowSizes = getWindowDimensions();
            setDescHeight(windowSizes.height - 150 - DEFAULT_HEIGTH);
            const canvas: any = document.getElementById("canvas");
            if (canvas) {
                canvas.height = DEFAULT_HEIGTH;
                canvas.width = DEFAULT_HEIGTH;
            }
        }
        await loadCartridge();
        movePageToBottom();
        if (selectedCartridge?.replay){
            setReplayLog(selectedCartridge.replay);
            setIsReplaying(true);
            setReplayTip(true);
        }
        if (selectedCartridge?.gameplayLog) {
            setReplayLog(selectedCartridge.gameplayLog);
            setIsReplaying(false);
            setReplayTip(true);
        }
    }

    async function loadCartridge() {
        if (!selectedCartridge || !selectedCartridge?.play || selectedCartridge.cartridgeData != undefined) return;
        const data = await cartridge({id:selectedCartridge.id},{decode:true,decodeModel:"bytes", cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"});
        setCartridgeData(data);
    }

    if (!selectedCartridge || !selectedCartridge.initCanvas) {
        return  <></>;
    }

    var decoder = new TextDecoder("utf-8");
    let parser = new Parser();
    let scoreFunction = parser.parse('score');

    function coverFallback() {
        return (
            <Image alt={"Cover " + selectedCartridge?.name} 
            id="canvas-cover" className="cartridge-cover" 
            height={canvasHeight} width={canvasWidth} 
            src={selectedCartridge?.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/cartesi.jpg"}
            style={{
                maxHeight: canvasHeight,
                maxWidth: canvasWidth,
                objectFit:'contain'
            }}
            />
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
        setReplayTip(false);
        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuHalt();
        setIsPlaying(true);

        if (selectedCartridge.scoreFunction)
            scoreFunction = parser.parse(selectedCartridge.scoreFunction);
        // @ts-ignore:next-line
        let buf = Module._malloc(selectedCartridge.cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.cartridgeData, buf);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(selectedCartridge.inCard?.length || 0);
        // @ts-ignore:next-line
        if (selectedCartridge?.inCard) Module.HEAPU8.set(selectedCartridge.inCard, incardBuf);
        let params = selectedCartridge?.args || "";
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
                params
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
        setReplayTip(false);
        if (selectedCartridge.cartridgeData == undefined || selectedCartridge.outcard != undefined || selectedCartridge.outhash != undefined)
            setIsReplaying(true);
        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuHalt();
        setIsPlaying(true);

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
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(selectedCartridge.inCard?.length || 0);
        // @ts-ignore:next-line
        if (selectedCartridge?.inCard) Module.HEAPU8.set(selectedCartridge.inCard, incardBuf);
        let params = selectedCartridge?.args || "";
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_replay",
            null,
            ['number', 'number', 'number', 'number', 'string', 'number', 'number'],
            [
                cartridgeBuf,
                selectedCartridge.cartridgeData.length,
                incardBuf,
                selectedCartridge.inCard?.length || 0,
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
        // @ts-ignore:next-line
        rivemuHalt();
        movePageToTop();
        // stopCartridge();
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
            const canvas: any = document.getElementById("canvas");
            setGameHeigth(height);
            if (canvas) {
                canvas.height = Math.floor(canvasHeight / height) * height;
                canvas.width = Math.floor(width / height * canvas.height);
            }
            console.log("rivemu_on_begin");
            // setIsLoading(false);
            // force canvas resize
            window.dispatchEvent(new Event("resize"));
        };

        // @ts-ignore:next-line
        window.rivemu_on_finish = function (
            rivlog: ArrayBuffer,
            outcard: ArrayBuffer,
            outhash: string
        ) {
            if (!isReplaying) {
                setGameplay(new Uint8Array(rivlog),new Uint8Array(outcard),outhash);
                setReplayLog(new Uint8Array(rivlog));
            }
            console.log("rivemu_on_finish")
        };
    }


    return (
        <section className='h-svh' hidden={selectedCartridge?.cartridgeData==undefined}>
            <div className='h-24 grid grid-cols-3 gap-4 content-start'>
                <div></div>
                <div className="flex flex-wrap place-content-evenly">
                    <button className="button-57"
                        onKeyDown={(e) => e.preventDefault()}
                        onClick={rivemuStart}
                        disabled={selectedCartridge?.cartridgeData == undefined}
                        // loading={isLoading}
                        // leftSection={
                        //     isPlaying ? (
                        //         <TbPlayerSkipBackFilled />
                        //     ) : (
                        //         <TbPlayerPlayFilled />
                        //     )
                        // }
                    >
                        <span>{isPlaying ? <ReplayIcon/> : <PlayArrowIcon/>}</span>
                        <span>{isPlaying ? "Restart" : "Start"}</span>
                    </button>
                    <button className={`button-57 ${replayTip ? "animate-bounce" : ""}`}
                        id="replayButton"
                        onKeyDown={(e) => e.preventDefault()}
                        onClick={rivemuReplay}
                        // leftSection={<TbPlayerStopFilled />}
                        disabled={selectedCartridge?.cartridgeData == undefined || replayLog == undefined}
                    >
                        <span><OndemandVideoIcon/></span>
                        <span>Replay</span>
                    </button>
                    <button className="button-57"
                        onKeyDown={(e) => e.preventDefault()}
                        onClick={rivemuStop}
                        // leftSection={<TbPlayerStopFilled />}
                    >
                        <span><Stop/></span>
                        <span>Stop</span>
                    </button>
                    <button className="button-57"
                        onKeyDown={(e) => e.preventDefault()}
                        onClick={()=>setIsExpanded(!isExpanded)}
                        // leftSection={<TbPlayerStopFilled />}
                        disabled={gameHeigth == 0}
                    >
                        <span>{isExpanded ? <CloseFullscreenIcon/> : <OpenInFullIcon/>}</span>
                        <span>{isExpanded ? "Shrink" : "Expand"}</span>
                    </button>
                </div>
            </div>
            <div className="flex justify-center">
            {/* <div className="flex justify-center max-h-400"> */}
                {/* TODO: fix suspense rivemu canvas */}
                {/* <Suspense fallback={coverFallback()}> */}
                <div className='relative'
                    style={{
                        height: canvasHeight,
                        width: canvasWidth
                    }}
                    >
                    <div hidden={!isPlaying && playedOnce} className='flex justify-center'>
                        <canvas
                            id="canvas"
                            onContextMenu={(e) => e.preventDefault()}
                            tabIndex={1}
                        />
                    </div>
                    {/* <div hidden={isPlaying} style={{backgroundColor: "black"}}> */}
                    <div hidden={isPlaying} className='absolute top-0'>
                        {coverFallback()}
                    </div>
                {/* </Suspense> */}
                </div>
            </div>
            <div className="text-center d-flex justify-content-center" hidden={selectedCartridge?.cartridgeData == undefined}>
                <h3 className={fontPressStart2P.className}>Score: <span>{overallScore}</span></h3>
            </div>

            <div className="text-left d-flex justify-content-center" hidden={isExpanded}>
                <div className='h-4'></div>
                <div className='grid grid-cols-3 gap-4 content-start'>
                    <div></div>
                    <fieldset className="overflow-auto custom-scrollbar" style={{maxHeight: descHeight}}>
                        <pre style={{whiteSpace: "pre-wrap"}}>
                            {selectedCartridge.info?.description}
                        </pre>
                    </fieldset>
                </div>
            </div>
            <Script src="/rivemu.js?" strategy="lazyOnload" />
        </section>
    )
}

export default Rivemu