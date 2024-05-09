"use client"

import Script from "next/script"
import { useState, useImperativeHandle, forwardRef } from "react";

export type RivemuRef = {
	stop: () => void;
	fullScreen: () => void;
	start: () => void;
	setSpeed: (speed:number) => void;
};

interface RivemuProps {
    cartridge_data?: Uint8Array,
    args?:string, 
    in_card?:Uint8Array, 
    entropy?:string,
    tape?:Uint8Array,
    rivemu_on_frame(outcard: ArrayBuffer,frame: number,cycles: number,fps: number,
        cpu_cost: number,cpu_speed: number,cpu_usage: number,cpu_quota: number): void,
    rivemu_on_begin(width: number, height: number, target_fps: number, total_frames: number): void,
    rivemu_on_finish(rivlog: ArrayBuffer,outcard: ArrayBuffer,outhash: string): void
};

const Rivemu = forwardRef<RivemuRef,RivemuProps> ((props,ref) => {
    const {cartridge_data, args, in_card, entropy, tape, rivemu_on_frame, rivemu_on_begin, rivemu_on_finish} = props;
    // rivemu state
    const [runtimeInitialized, setRuntimeInitialized] = useState(false);

    useImperativeHandle(ref, () => ({
		start: rivemuStart,
        stop: rivemuStop,
        fullScreen: rivemuFullscreen,
        setSpeed: rivemuSetSpeed
	}));

    if (!cartridge_data) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                No Cartridge...
            </main>
        )
    }
      
    // BEGIN: rivemu
    async function rivemuStart() {
        if (!cartridge_data || cartridge_data.length == 0) return;
        console.log("rivemuStart");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuInitialize();
        await rivemuHalt();

        // @ts-ignore:next-line
        let cartridgeBuf = Module._malloc(cartridge_data.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(cartridge_data, cartridgeBuf);;
        const inCard = in_card || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = args || "";
        if (tape && tape.length > 0) {
            // @ts-ignore:next-line
            const rivlogBuf = Module._malloc(tape.length);
            // @ts-ignore:next-line
            Module.HEAPU8.set(tape, rivlogBuf);
            // @ts-ignore:next-line
            Module.ccall(
                "rivemu_start_replay",
                null,
                ['number', 'number', 'number', 'number', 'string', 'string', 'number', 'number'],
                [
                    cartridgeBuf,
                    cartridge_data.length,
                    incardBuf,
                    inCard.length,
                    entropy,
                    params,
                    rivlogBuf,
                    tape.length
                ]
            );
            // @ts-ignore:next-line
            Module._free(rivlogBuf);
        } else {
            console.log("rivemuStart");

            // @ts-ignore:next-line
            Module.ccall(
                "rivemu_start_record",
                null,
                ['number', 'number', 'number', 'number', 'string', 'string'],
                [
                    cartridgeBuf,
                    cartridge_data.length,
                    incardBuf,
                    inCard.length,
                    entropy,
                    params
                ]
            );
        }
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
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

    function rivemuFullscreen() {
        const canvas: any = document.getElementById("canvas");
        if (canvas) {
            canvas.requestFullscreen();
        }
    }

    function rivemuSetSpeed(speed: number) {
        if (tape && tape.length > 0) {
            // @ts-ignore:next-line
            Module.ccall('rivemu_set_speed', null, ['number'], [speed]);
        }
    }

    if (typeof window !== "undefined") {
        // @ts-ignore:next-line
        window.rivemu_on_frame = rivemu_on_frame;

        // @ts-ignore:next-line
        window.rivemu_on_begin = rivemu_on_begin;

        // @ts-ignore:next-line
        window.rivemu_on_finish = rivemu_on_finish;
    }
    // END: rivemu

    return (
        <main className="flex items-center justify-center">
            <canvas
                className='gameplay-screen t-0 border border-gray-500'
                id="canvas"
                onContextMenu={(e) => e.preventDefault()}
                tabIndex={-1}
                style={{
                    imageRendering: "pixelated",
                    objectFit: "contain"
                }}
            />
            <Script src="/rivemu.js?" strategy="lazyOnload" />
            <Script src="/initializeRivemu.js?" strategy="lazyOnload" />
        </main>
    )
})

Rivemu.displayName = 'Rivemu';

export default Rivemu