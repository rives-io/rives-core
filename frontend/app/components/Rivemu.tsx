"use client"


import React, { useContext, useState, useEffect, Suspense } from 'react'
import Script from "next/script";
import Image from 'next/image';
import {Parser} from 'expr-eval';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Stop from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
// import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'; // for cartridge download

import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { cartridge } from '../backend-libs/app/lib';

// let rivlogData: Uint8Array | undefined = undefined;

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
async function movePageToBottom() {
    await delay(500);
    window.scrollTo({left: 0, top: document.body.scrollHeight, behavior: 'smooth'});
}

async function movePageToTop() {
    await delay(500);
    window.scrollTo({left: 0, top: 0, behavior: 'smooth'});
}

function Rivemu() {
    const {selectedCartridge, setCartridgeData, setGameplay, stopCartridge} = useContext(selectedCartridgeContext);
    const [overallScore, setOverallScore] = useState(0);
    // const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [replayLog, setReplayLog] = useState<Uint8Array|undefined>(undefined);

    useEffect(()=>{
        if (!selectedCartridge || !selectedCartridge?.play) return;
        initialize();
    }
    ,[selectedCartridge?.playToggle])

    function initialize() {
        movePageToBottom();
        loadCartridge();
        if (selectedCartridge?.gameplayLog) setReplayLog(selectedCartridge.gameplayLog);
    }

    async function loadCartridge() {
        if (!selectedCartridge || !selectedCartridge?.play || selectedCartridge.cartridgeData != undefined) return;
        const data = await cartridge({id:selectedCartridge.id},{decode:true,decodeModel:"bytes"});
        setCartridgeData(data);
    }
    
    if (!selectedCartridge) {
       return  <></>;
    }
    
    var decoder = new TextDecoder("utf-8");
    let parser = new Parser();
    let scoreFunction = parser.parse('score');

    function coverFallback() {
        return (
            <Image alt={"Cover " + selectedCartridge?.name} id="canvas-cover" className="cartridge-cover" height={400} width={640} src={selectedCartridge?.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/cartesi.jpg"}/>
        );
    }

    async function rivemuStart() {
        // setIsLoading(true);
        setIsPlaying(true);
        // @ts-ignore:next-line
        if (Module.quited) {
            // restart wasm when back to page
            // @ts-ignore:next-line
            Module._main();
        }

        if (!selectedCartridge?.cartridgeData) return;
        console.log("rivemuStart");
        if (selectedCartridge.scoreFunction)
            scoreFunction = parser.parse(selectedCartridge.scoreFunction);
        // @ts-ignore:next-line
        let buf = Module._malloc(selectedCartridge.cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(selectedCartridge.cartridgeData, buf);
        let params = selectedCartridge?.args || "";
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_ex",
            selectedCartridge.inCard || null,
            ["number", "number", "string"],
            [buf, selectedCartridge.cartridgeData.length, params]
        );
        // @ts-ignore:next-line
        Module._free(buf);
    }

    async function rivemuReplay() {
        // TODO: fix rivemuReplay
        if (!selectedCartridge?.cartridgeData || !replayLog) return;
        console.log("rivemuReplay");
        setIsPlaying(true);
        // @ts-ignore:next-line
        if (Module.quited) {
            // restart wasm when back to page
            // @ts-ignore:next-line
            Module._main();
        }

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
        let params = selectedCartridge?.args || "";
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_replay_ex",
            selectedCartridge.inCard || null,
            ["number", "number", "number", "number", "string"],
            [
                cartridgeBuf,
                selectedCartridge.cartridgeData.length,
                rivlogBuf,
                replayLog.length,
                params,
            ]
        );
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
        // @ts-ignore:next-line
        Module._free(rivlogBuf);
    }

    async function rivemuStop() {
        console.log("rivemuStop");
        movePageToTop();
        setIsPlaying(false);
        stopCartridge();
        // @ts-ignore:next-line
        Module.cwrap("rivemu_stop")();
    }

    if (typeof window !== "undefined") {
        // @ts-ignore:next-line
        window.rivemu_on_outcard_update = function (outcard: any) {
            const outcard_str = decoder.decode(outcard);
            const outcard_json = JSON.parse(outcard_str.substring(4));
            let score = outcard_json.score;
            if (selectedCartridge?.scoreFunction) {
                score = scoreFunction.evaluate(outcard_json);
            }
            setOverallScore(score);
        };

        // @ts-ignore:next-line
        window.rivemu_on_begin = function (width: any, height: any) {
            console.log("rivemu_on_begin");
            // setIsLoading(false);
            // force canvas resize
            window.dispatchEvent(new Event("resize"));
        };

        // @ts-ignore:next-line
        window.rivemu_on_finish = function (
            rivlog: ArrayBuffer,
            outcard: ArrayBuffer
        ) {
            setIsPlaying(false);
            setGameplay(new Uint8Array(rivlog),decoder.decode(outcard));
            setReplayLog(new Uint8Array(rivlog));
        };
    }


    return (
        <section className='h-svh'>
            <div className='h-56 grid grid-cols-3 gap-4 content-start'>
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
                    <button className="button-57"
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
                </div>
            </div>
            <div className="flex justify-center max-h-400">
                {/* TODO: fix suspense rivemu canvas */}
                {/* <Suspense fallback={coverFallback()}> */}
                    <canvas
                        // hidden={selectedCartridge?.cartridgeData == undefined}
                        // key={selectedCartridge.name+selectedCartridge.cartridgeData?.length}
                        id="canvas"
                        height={400}
                        width={640}
                        onContextMenu={(e) => e.preventDefault()}
                        tabIndex={1}

                        style={{
                            maxHeight: 400,
                        }}
                    />
                {/* </Suspense> */}
            </div>1
            <div className="text-center d-flex justify-content-center">
                <h3>Score: <span>{overallScore}</span></h3>
            </div>

            <Script src="/rivemu.js" strategy="lazyOnload" />
        </section>
    )
}

export default Rivemu