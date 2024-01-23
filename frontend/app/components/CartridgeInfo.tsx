"use client"

import { ethers } from "ethers";
import React, { Suspense, useContext, useRef, useState } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PublishIcon from '@mui/icons-material/Publish';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import { Tab } from '@headlessui/react'
import { Canvas } from '@react-three/fiber';
import DescriptionIcon from '@mui/icons-material/Description';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import StadiumIcon from '@mui/icons-material/Stadium';
import CodeIcon from '@mui/icons-material/Code';
import useDownloader from "react-use-downloader";
import { useConnectWallet } from "@web3-onboard/react";
import { sha256 } from "js-sha256";

import Cartridge from "../models/cartridge";
import {SciFiPedestal} from "../models/scifi_pedestal";
import Loader from "../components/Loader";
import { replay } from '../backend-libs/app/lib';
import { Replay } from '../backend-libs/app/ifaces';
import CartridgeDescription from './CartridgeDescription';
import Link from 'next/link';
import CartridgeScoreboard from './CartridgeScoreboard';
import { envClient } from "../utils/clientEnv";
import { fontPressStart2P } from '../utils/font';
import { delay } from "../utils/util";
import CheckIcon from "./svg/CheckIcon";
import ErrorIcon from "./svg/ErrorIcon";


enum STATUS {
    READY,
    VALIDATING,
    VALID,
    INVALID,
}

interface LOG_STATUS {
    status:STATUS,
    error?:string
}

function logFeedback(logStatus:LOG_STATUS, setLogStatus:Function) {
    if (logStatus.status === STATUS.VALID) {
        delay(2500).then(() =>{
            setLogStatus({status: STATUS.READY} as LOG_STATUS);
        })
        return (
            <div className="fixed flex items-center max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow-lg right-5 bottom-20 dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800" role="alert">
                <CheckIcon/>
                <div className="ms-3 text-sm font-bold">Log Validated</div>
            </div>
        )
    } else if (logStatus.status === STATUS.INVALID) {
        const click = () => {
            setLogStatus({status: STATUS.READY} as LOG_STATUS)
        }
        return (
            <div className="fixed flex-col items-center max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow right-5 bottom-[20%] dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800" role="alert">
                <div className="flex items-center pb-1 border-b">
                    <ErrorIcon/>
                    <div className="ms-3 text-sm font-normal">Invalid Log.</div>
                    <button onClick={click} type="button" className="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" data-dismiss-target="#toast-danger" aria-label="Close">
                        <span className="sr-only">Close</span>
                        <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                        </svg>
                    </button>
                </div>
                <div>
                    {logStatus.error}
                </div>
            </div>
        )
    }
}

function scoreboardFallback() {
    const arr = Array.from(Array(3).keys());

    return (
        <table className="w-full text-sm text-left">
            <thead className="text-xsuppercase">
                <tr>
                    <th scope="col" className="px-6 py-3">
                        User
                    </th>
                    <th scope="col" className="px-6 py-3">
                        Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3">
                        Score
                    </th>
                </tr>
            </thead>
            <tbody className='animate-pulse'>
                {
                    arr.map((num, index) => {
                        return (
                            <tr key={index} className='mb-3 h-16'>
                                <td className="px-6 py-4 break-all">
                                    <div className='fallback-bg-color rounded-md'>
                                        0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        31/12/1969, 21:06:36
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                }

            </tbody>
        </table>
    )
}

function CartridgeInfo() {
    const {selectedCartridge, playCartridge, setGameplay} = useContext(selectedCartridgeContext);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [{ wallet }, connect] = useConnectWallet();
    const { download } = useDownloader();
    const [submitLogStatus, setSubmitLogStatus] = useState({status: STATUS.READY} as LOG_STATUS);

    if (!selectedCartridge) return <></>;

    async function submitLog() {
        // replay({car});
        if (!selectedCartridge || !selectedCartridge.gameplayLog || !selectedCartridge.outcard){
            alert("No gameplay data.");
            return;
        }
        if (!wallet) {
            alert("Connect first to upload a gameplay log.");
            return;
        }

        const signer = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
        const inputData: Replay = {
            cartridge_id:"0x"+selectedCartridge.id,
            outcard_hash: "0x"+sha256(selectedCartridge.outcard),
            args: selectedCartridge.args || "",
            in_card: selectedCartridge.inCard ? ethers.utils.hexlify(selectedCartridge.inCard) : "0x",
            log: ethers.utils.hexlify(selectedCartridge.gameplayLog)
        }

        setSubmitLogStatus({status: STATUS.VALIDATING});
        try {
            const replayRes = await replay(signer, envClient.DAPP_ADDR, inputData, {decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL});
            console.log(replayRes);
            setSubmitLogStatus({status: STATUS.VALID});
        } catch (error) {
            setSubmitLogStatus({status: STATUS.INVALID, error: (error as Error).message});
        }
    }

    async function uploadLog() {
        // replay({car});
        fileRef.current?.click();
    }

    async function downloadLog() {
        // replay({car});
        const filename = "gameplay.rivlog";
        const blobFile = new Blob([selectedCartridge?.gameplayLog!], {
            type: "application/octet-stream",
        });
        const file = new File([blobFile], filename);
        const urlObj = URL.createObjectURL(file);
        download(urlObj, filename);
    }

    function handleOnChange(e: any) {
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            const data = readerEvent.target?.result;
            if (data) {
                setGameplay(new Uint8Array(data as ArrayBuffer));
            }
        };
        reader.readAsArrayBuffer(e.target.files[0])
    }

    return (
        <fieldset className='h-full custom-shadow'>
            <legend className="ms-2 px-1">
                <span className={`cartridge-title-text ${fontPressStart2P.className}`}>{selectedCartridge.name}</span>
                <br/>
                <span className='muted-text'>
                    Uploaded by {selectedCartridge.user_address} on {new Date(selectedCartridge.created_at*1000).toLocaleString()}
                </span>
            </legend>
            <div className="flex flex-row h-full">
                <div className="basis-1/4 h-1/2">
                    <Canvas shadows camera={ {near: 0.1, far: 1000, position: [0,0,0]} }>

                        <Suspense fallback={<Loader />}>
                            <ambientLight intensity={1} />
                            <pointLight position={[4, -5, -10]} intensity={20} />
                            <pointLight position={[-4, -5, -10]} intensity={20} />
                            <spotLight
                                position={[0, -5, -10]}
                                angle={Math.PI}
                                penumbra={1}
                                intensity={80}
                            />
                            <hemisphereLight
                                color='#b1e1ff'
                                groundColor='#000000'
                                intensity={1}
                            />

                            <Cartridge
                            rotation={[0, -Math.PI/2, 0]}
                                key={selectedCartridge.cover}
                                position={[0,0,-10]}
                                cover={selectedCartridge.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/cartesi.jpg"}
                                scale={[1, 1, 1]}
                            />
                            <SciFiPedestal position={[0, -5, -10]} scale={[0.3,0.3,0.3]}/>

                        </Suspense>

                    </Canvas>
                    <input type="file" ref={fileRef} onChange={(e) => handleOnChange(e)} style={{ display: 'none' }}/>
                    <div className="flex flex-wrap place-content-evenly">
                        <button className="button-57" onClick={() => {playCartridge()}}>
                            <span><PowerSettingsNewIcon/></span>
                            <span>Turn on</span>
                        </button>

                        <button className={"button-57"} onClick={() => {submitLog()}}
                        disabled={!selectedCartridge.gameplayLog || !wallet || submitLogStatus.status != STATUS.READY}>
                            {
                                submitLogStatus.status === STATUS.READY?
                                    <>
                                        <span><PublishIcon/></span>
                                        <span>Submit Log</span>
                                    </>
                                :
                                    <>
                                        <span>
                                            <div className='w-5 h-5 border-2 rounded-full border-current animate-spin'>
                                            </div>
                                        </span>

                                        <span>
                                            Validating
                                        </span>
                                    </>
                            }
                        </button>

                        <button className="button-57" onClick={() => {uploadLog()}}>
                            <span><UploadIcon/></span>
                            <span>Upload Log</span>
                        </button>

                        <button className={"button-57"} onClick={() => {downloadLog()}} disabled={!selectedCartridge.gameplayLog}>
                            <span><DownloadIcon/></span>
                            <span>Download Gameplay</span>
                        </button>

                    </div>

                    {
                        !(selectedCartridge.info?.authors)?
                            <></>
                        :
                            <div className='mt-3'>
                                <span className={`ms-2 font-bold text-xl ${fontPressStart2P.className}`}>
                                    Creators
                                </span>

                                <ul className='flex flex-col space-y-1'>
                                    {selectedCartridge.info?.authors?.map((author) => (
                                        <li key={author.name}><Link className='ms-8 font-semibold link-2step-hover' href={author.link}>{author.name}</Link></li>
                                    ))}
                                </ul>

                            </div>
                    }

                </div>

                <div className="basis-3/4 flex flex-col py-2 max-h-full">
                    <Tab.Group>
                        <Tab.List className="game-option-tabs-header">
                            <Tab
                                className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                >
                                    <span className='game-tabs-option-text'>
                                        <DescriptionIcon/>
                                        <span>Description</span>
                                    </span>
                            </Tab>

                            <Tab
                                className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                >
                                    <span className='game-tabs-option-text'>
                                        <LeaderboardIcon/>
                                        <span>Scoreboards</span>
                                    </span>
                            </Tab>

                            <Tab
                                className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                >
                                    <span className='game-tabs-option-text'>
                                        <StadiumIcon/>
                                        <span>Tournaments</span>
                                    </span>
                            </Tab>

                            <Tab
                                className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                >
                                    <span className='game-tabs-option-text'>
                                        <CodeIcon/>
                                        <span>Mods</span>
                                    </span>
                            </Tab>
                        </Tab.List>

                        <Tab.Panels className="mt-2 pr-1 overflow-auto custom-scrollbar">
                            <Tab.Panel
                                className="game-tab-content"
                            >
                                <CartridgeDescription/>
                            </Tab.Panel>

                            <Tab.Panel
                                className="game-tab-content"
                            >
                                <Suspense fallback={scoreboardFallback()}>
                                    <CartridgeScoreboard cartridge_id={selectedCartridge.id}/>
                                </Suspense>

                            </Tab.Panel>

                            <Tab.Panel
                                className="game-tab-content"
                            >
                                <span className={`${fontPressStart2P.className}`}>Coming Soon!</span>
                            </Tab.Panel>

                            <Tab.Panel
                                className="game-tab-content"
                            >
                                <span className={`${fontPressStart2P.className}`}>Coming Soon!</span>
                            </Tab.Panel>
                        </Tab.Panels>
                    </Tab.Group>
                </div>
            </div>

            {
                logFeedback(submitLogStatus, setSubmitLogStatus)
            }

        </fieldset>
    )
}

export default CartridgeInfo