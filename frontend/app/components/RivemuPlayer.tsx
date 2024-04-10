"use client"

import { Parser } from "expr-eval";
import Script from "next/script"
import { useContext, useState } from "react";

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import { gameplayContext } from "../play/GameplayContextProvider";


function RivemuPlayer(
{cartridgeData, args, in_card, score_function, tape}:
{cartridgeData:Uint8Array, args:string, in_card:Uint8Array, score_function:string, tape?:Uint8Array}) {
    const {setGameplayLog} = useContext(gameplayContext);

    const isTape = tape? true:false;

    // rivemu state
    const [currScore, setCurrScore] = useState(0);
    const [playing, setPlaying] = useState({isPlaying: false, playCounter: 0})
    
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
        setCurrScore(0);

        // @ts-ignore:next-line
        let cartridgeBuf = Module._malloc(cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(cartridgeData, cartridgeBuf);
        const inCard = in_card || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = args || "";
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
        setCurrScore(0);

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
        let scoreFunction = score_function? parser.parse(score_function):null;
    
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
                if (scoreFunction) {
                    score = scoreFunction.evaluate(outcard_json);
                }
            }
            setCurrScore(score);
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
            if (!isTape) {
                setGameplayLog(
                    {
                        log: new Uint8Array(rivlog),
                        outcard: {
                            value: new Uint8Array(outcard),
                            hash: outhash
                        }
                    }
                );    
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
        <main className="flex items-center justify-center h-lvh">
            <section>
                {
                    !playing.isPlaying?
                        <button className='gameplay-screen border text-gray-500 hover:text-white' onClick={isTape? playTape: playGame}>
                            {
                                playing.playCounter === 0?
                                    <PlayArrowIcon className='text-7xl'/>
                                :
                                    <ReplayIcon className='text-7xl'/>
                            }
                            
                        </button>
                    :
                        <canvas
                            className='gameplay-screen border'
                            id="canvas"
                            onContextMenu={(e) => e.preventDefault()}
                            tabIndex={-1}
                            style={{
                                imageRendering: "pixelated",
                                objectFit: "contain"
                            }}
                        />
                }
            </section>
            <Script src="/rivemu.js?" strategy="lazyOnload" />
        </main>
    )
}

export default RivemuPlayer