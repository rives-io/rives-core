"use client"

import { ethers } from "ethers";
import { VerificationOutput,VerifyPayload,cartridge, getOutputs } from '@/app/backend-libs/core/lib';
import { envClient } from '@/app/utils/clientEnv';
import React, { useEffect, useState } from 'react'
import ReportIcon from '@mui/icons-material/Report';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';

import { Parser } from 'expr-eval';
import Script from 'next/script';


const getScoreInfo = async (tapeId:string):Promise<VerificationOutput> => {
    const scores:Array<VerificationOutput> = await getOutputs(
        {
            tags: ["score",tapeId],
        }, {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );

    if (scores.length === 0) throw new Error(`Verification output not found for tape ${tapeId}!`);
    
    return scores[0];
}

const getCartridgeData = async (cartridgeId:string) => {
    const formatedCartridgeId = cartridgeId.slice(2);
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
    
    if (data.length === 0) throw new Error(`Tape ${formatedCartridgeId} not found!`);
    
    return data;
}


const getTape = async (tapeId:string):Promise<Uint8Array> => {
    const replayLogs:Array<VerifyPayload> = await getOutputs(
        {
            tags: ["tape",tapeId],
            type: 'input'
        },
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );
    console.log(replayLogs[0])
    const tape = replayLogs[0].tape;
    
    if (typeof tape == "string" && ethers.utils.isHexString(tape))
        return ethers.utils.arrayify(tape);
    return new Uint8Array([]);
}


export default function Tape({ params }: { params: { tape_id: string } }) {
    
    // state managing
    const [scoreInfo, setScoreInfo] = useState<VerificationOutput|null>(null)
    const [cartridgeData, setCartridgeData] = useState<Uint8Array|null>(null)
    const [tape, setTape] = useState<Uint8Array|null>(null)
    const [error, setError] = useState<String|null>(null);

    // riv state
    const [currScore, setCurrScore] = useState(0);
    const [playing, setPlaying] = useState({isPlaying: false, playCounter: 0})

    useEffect(() => {
        getScoreInfo(params.tape_id)
        .then((score) => {
            setScoreInfo(score);
            getCartridgeData(score.cartridge_id)
            .then(setCartridgeData)
            .catch((error) => setError((error as Error).message));
        })
        .catch((error) => setError((error as Error).message));
    }, [])

    useEffect(() => {
        getTape(params.tape_id).then(setTape);
    }, [cartridgeData])


    // BEGIN: error and feedback handling
    if (error) {
        return (
            <main className="flex items-center justify-center h-lvh">
                <div className='flex w-96 flex-wrap break-all justify-center'>
                    <ReportIcon className='text-red-500 text-5xl' />
                    <span style={{color: 'white'}}> {error}</span>
                </div>
            </main>
        )
    }

    if (!scoreInfo) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Info...
            </main>
        )
    }

    if (!cartridgeData) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Cartridge...
            </main>
        )
    }

    if (!tape) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Tape...
            </main>
        )
    }
    // END: error and feedback handling


    // BEGIN: rivemu
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
        const inCard = new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = "";
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
        var decoder = new TextDecoder("utf-8");
        let parser = new Parser();
        let scoreFunction = parser.parse('score');
    
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
            setPlaying({isPlaying: false, playCounter: playing.playCounter+1})
        };
    }
    // END: rivemu

    function playTape() {
        setPlaying({...playing, isPlaying: true});
        rivemuReplay();
    }

    return (
        <main className="flex items-center justify-center h-lvh">
            <section>
                {
                    !playing.isPlaying?
                        <button className='gameplay-screen border text-gray-500 hover:text-white' onClick={playTape}>
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

