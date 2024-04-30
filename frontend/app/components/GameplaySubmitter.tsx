"use client"




import { useContext, useEffect, useState, Fragment } from "react";
import { gameplayContext } from "../play/GameplayContextProvider";
import { useConnectWallet } from "@web3-onboard/react";
import { insertTapeGif } from "../utils/util";
import { sha256 } from "js-sha256";
import { ContractReceipt, ethers } from "ethers";
import { VerifyPayload } from "../backend-libs/core/ifaces";
import { envClient } from "../utils/clientEnv";
import { registerExternalVerification } from "../backend-libs/core/lib";
import { Dialog, Transition } from '@headlessui/react'
import Image from "next/image";
import { TwitterShareButton, TwitterIcon } from 'next-share';
import { SOCIAL_MEDIA_HASHTAGS } from "../utils/common";
import ReportIcon from '@mui/icons-material/Report';
import { cartridgeInfo } from '../backend-libs/core/lib';
import { CartridgeInfo as Cartridge } from "../backend-libs/core/ifaces";

// @ts-ignore
import GIFEncoder from "gif-encoder-2";


enum MODAL_STATE {
    SUBMIT,
    SUBMITTING,
    SUBMITTED
}

function generateGif(frames: string[], width:number, height:number): Promise<string> {

    const encoder = new GIFEncoder(width, height, 'octree', true);
    encoder.setDelay(200);
    encoder.start();
    
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    let idx = 0;
    const addFrames = new Array<Promise<void>>();
    
    for (const frame of frames) {
        
        const p: Promise<void> = new Promise(resolveLoad => {
            const img = document.createElement("img");
            img.width = width;
            img.height = height;
            img.onload = () => {
                ctx?.drawImage(img,0,0,img.width,img.height);
                encoder.addFrame(ctx);
                resolveLoad();
            };
            img.src = frame;
        })
        addFrames.push(p);
        idx++;
    }
    return Promise.all(addFrames).then(() => {
        encoder.finish();
        const buffer = encoder.out.getData();
        if (buffer) {
            var binary = '';
            var len = buffer.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode( buffer[ i ] );
            }
            return window.btoa( binary );
        }
        return "";
    });
    
}

function calculateTapeId(log: Uint8Array): string {
    return sha256(log);
}



function GameplaySubmitter() {
    const {gameplay, getGifParameters, clearGifFrames} = useContext(gameplayContext);
    const [{ wallet }, connect] = useConnectWallet();
    const [tapeURL, setTapeURL] = useState("");
    const [gifImg, setGifImg] = useState("");
    const [gameInfo, setGameInfo] = useState<Cartridge>();

    // modal state variables
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [modalState, setModalState] = useState(MODAL_STATE.SUBMIT);

    function closeModal() {

        setGifImg(""); // clear gif image
        setModalIsOpen(false)
    }
  
    function openModal() {
        setModalIsOpen(true)
    }

    useEffect(() => {
        // show warning message if user is not connected
        if (!wallet) openModal();
    }, [])

    useEffect(() => {
        if (!gameplay) return;

        //submitLog();
        prepareSubmission();
    }, [gameplay])

    async function prepareSubmission() {
        try {
            const gifParameters = getGifParameters();
            if (gifParameters) {
                const gif = await generateGif(gifParameters.frames, gifParameters.width, gifParameters.height);
                setGifImg(gif);
            }
        } catch (error) {
            console.log("Error getting gif parameters", error)
        }
        
        setModalState(MODAL_STATE.SUBMIT);
        openModal();
    }

    async function submitLog() {
        if (!gameplay){
            alert("No gameplay data.");
            return;
        }

        if (!wallet) {
            alert("Connect first to upload a gameplay log.");
            await connect();
        }

        // get cartridgeInfo asynchronously
        cartridgeInfo({id:gameplay.cartridge_id},{decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"})
        .then(setGameInfo);

        // submit the gameplay
        const signer = new ethers.providers.Web3Provider(wallet!.provider, 'any').getSigner();
        const inputData: VerifyPayload = {
            rule_id: '0x' + gameplay.rule_id,
            outcard_hash: '0x' + gameplay.outcard.hash,
            tape: ethers.utils.hexlify(gameplay.log),
            claimed_score: gameplay.score || 0
        }
        try {
            setModalState(MODAL_STATE.SUBMITTING);
            const receipt:ContractReceipt = await registerExternalVerification(signer, envClient.DAPP_ADDR, inputData, {sync:false, cartesiNodeUrl: envClient.CARTESI_NODE_URL}) as ContractReceipt;

        } catch (error) {
            console.log(error)
            setModalState(MODAL_STATE.SUBMIT);
            throw error;
        }

        const gameplay_id = calculateTapeId(gameplay.log);
        if (gifImg.length > 0) {
            await insertTapeGif(gameplay_id, gifImg);
        }

        if (typeof window !== "undefined") {
            setTapeURL(`${window.location.origin}/tapes/${gameplay_id}`);
        }
        
        setModalState(MODAL_STATE.SUBMITTED);
        clearGifFrames();

    }


    function modalBody() {
        let modalBodyContent:JSX.Element;

        if (modalState == MODAL_STATE.SUBMIT) {
            modalBodyContent = (
                <>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Submit your Gameplay
                    </Dialog.Title>
                    <div className="mt-4 text-center">
                        <Image className="border border-black" width={256} height={256} src={"data:image/gif;base64,"+gifImg} alt={"Not found"}/>
                    </div>
    
                    <div className="flex pb-2 mt-4">
                        <button
                        className={`bg-red-500 text-white font-bold uppercase text-sm px-6 py-2 border border-red-500 hover:text-red-500 hover:bg-transparent`}
                        type="button"
                        onClick={closeModal}
                        >
                            Cancel
                        </button>
                        <button
                        className={`bg-emerald-500 text-white font-bold uppercase text-sm px-6 py-2 ml-1 border border-emerald-500 hover:text-emerald-500 hover:bg-transparent`}
                        type="button"
                        onClick={submitLog}
                        >
                            Submit
                        </button>
                    </div>
                </>
            )
        } else if (modalState == MODAL_STATE.SUBMITTING) {
            modalBodyContent = (
                <>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Submitting Gameplay
                    </Dialog.Title>
        
                    <div className="p-6 flex justify-center mt-4">
                        <div className='w-12 h-12 border-2 rounded-full border-current border-r-transparent animate-spin'></div>
                    </div>

                </>
            )
        } else {
            modalBodyContent = (
                <>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Gameplay Submitted!
                    </Dialog.Title>

                    <div className="mt-4 text-center">
                        <button className="place-self-center" title='Tape' onClick={() => window.open(`${tapeURL}`, "_blank", "noopener,noreferrer")}>
                            <Image className="border border-black" width={256} height={256} src={"data:image/gif;base64,"+gifImg} alt={"Not found"}/>
                        </button>
                    </div>
                    <div className="mt-4 flex flex-col space-y-2">
                        <TwitterShareButton
                        url={tapeURL}
                        title={
                            gameInfo?.id == gameplay?.cartridge_id?
                                `Check out my ${gameInfo?.name} tape on @rives_io, the onchain fantasy console`
                            :
                                "Check out my tape on @rives_io, the onchain fantasy console"
                        }
                        hashtags={SOCIAL_MEDIA_HASHTAGS}
                        >
                            <div className="p-3 bg-[#eeeeee] text-[black] border border-[#eeeeee] hover:bg-black hover:text-[#eeeeee] flex space-x-2 items-center">
                            {/* <button className="p-3 bg-[#eeeeee] text-[black] border border-[#eeeeee] hover:bg-transparent hover:text-[#eeeeee] flex space-x-2 items-center"> */}
                                <span>Share on</span> <TwitterIcon size={32} round />
                            </div>
                            
                        </TwitterShareButton>

                        <button className="bg-emerald-500 text-white p-3 border border-emerald-500 hover:text-emerald-500 hover:bg-transparent"
                        onClick={closeModal}
                        >
                            Done
                        </button>
                    </div>
                </>
            )
        }

        return (
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden bg-gray-500 p-4 shadow-xl transition-all flex flex-col items-center">
                {modalBodyContent}
            </Dialog.Panel>
        )
    }

    if (!wallet) {
        return (
            <>    
                <Transition appear show={modalIsOpen} as={Fragment}>
                    <Dialog as="div" className="relative z-10" onClose={closeModal}>
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0 bg-black/25" />
                        </Transition.Child>
                
                        <div className="fixed inset-0 overflow-y-auto">
                            <div className="flex min-h-full items-center justify-center p-4 text-center">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-out duration-300"
                                    enterFrom="opacity-0 scale-95"
                                    enterTo="opacity-100 scale-100"
                                    leave="ease-in duration-200"
                                    leaveFrom="opacity-100 scale-100"
                                    leaveTo="opacity-0 scale-95"
                                >
                                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden bg-gray-500 p-4 shadow-xl transition-all flex flex-col items-center text-white">
                                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                                            <ReportIcon className='text-yellow-500 text-5xl' />
                                        </Dialog.Title>
                                        <div className='flex w-96 flex-wrap justify-center'>
                                            <span> You need to be connect for your gameplay to be saved!</span>
                                        </div>

                                        <button className="mt-4 bg-yellow-500 text-white p-3 border border-yellow-500 hover:text-yellow-500 hover:bg-transparent"
                                        onClick={closeModal}
                                        >
                                            OK
                                        </button>
                                    </Dialog.Panel>
                                </Transition.Child>
                            </div>
                        </div>
                    </Dialog>
                </Transition>
            </>
        )
    }

    return (
        <>    
            <Transition appear show={modalIsOpen} as={Fragment}>
                <Dialog as="div" className="relative z-10" onClose={closeModal}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/25" />
                    </Transition.Child>
            
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                {modalBody()}
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    )
}

export default GameplaySubmitter;