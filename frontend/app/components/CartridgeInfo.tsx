"use client"

import { ethers } from "ethers";
import React, { Suspense, useContext, useRef } from 'react'
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
        const replayRes = await replay(signer, envClient.DAPP_ADDR, inputData, {decode:true});
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
                <span className='cartridge-title-text'>{selectedCartridge.name}</span>
                <br/>
                <span className='muted-text text-sm'>
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

                        <button className={"button-57"} onClick={() => {submitLog()}} disabled={!selectedCartridge.gameplayLog || !wallet}>
                            <span><PublishIcon/></span>
                            <span>Submit Log</span>
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
                                <span className='ms-2 font-bold text-xl'>
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
                                disabled
                                >
                                    <span className='game-tabs-option-text'>
                                        <StadiumIcon/>
                                        <span>Tournaments</span>
                                    </span>
                            </Tab>

                            <Tab
                                className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                                disabled
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
                                <></>
                            </Tab.Panel>

                            <Tab.Panel
                                className="game-tab-content"
                            >
                                <></>
                            </Tab.Panel>
                        </Tab.Panels>
                    </Tab.Group>
                </div>
            </div>
        </fieldset>
    )
}

export default CartridgeInfo