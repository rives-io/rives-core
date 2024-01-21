"use client"

import { ethers } from "ethers";
import React, { Suspense, useContext, useRef } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
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
        let appAddress = process.env.NEXT_PUBLIC_INPUT_BOX_ADDR;
        if (!process.env.NEXT_PUBLIC_INPUT_BOX_ADDR) {
            // TODO: fix env vars
            appAddress = "0x70ac08179605AF2D9e75782b8DEcDD3c22aA4D0C";
        }
        if (!appAddress) return;
        const signer = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
        const inputData: Replay = {
            cartridge_id:"0x"+selectedCartridge.id,
            outcard_hash: "0x"+sha256(selectedCartridge.outcard.replace(/\s|\n|\r|\t/g, '')),
            args: selectedCartridge.args || "",
            in_card: selectedCartridge.inCard ? ethers.utils.hexlify(selectedCartridge.inCard) : "0x",
            log: ethers.utils.hexlify(selectedCartridge.gameplayLog)
        }
        const replayRes = await replay(signer,appAddress,inputData,{decode:true});
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

    const tabs = [
		{
			id: 0,
			label: {icon: <DescriptionIcon/>, text: "Description"},
			content: selectedCartridge.info?.summary
		},
		{
			id: 1,
			label: {icon: <LeaderboardIcon/>, text: "Leaderboard"},
			content: "Query Leaderboard"
		},
		{
			id: 2,
			label: {icon: <StadiumIcon/>, text: "Tournaments"},
			content: "Query Game Tournaments"
		},
		{
			id: 3,
			label: {icon: <CodeIcon/>, text: "Mods"},
			content: "Query Game Mods"
		},
	];

    return (
        <fieldset className='h-full custom-shadow'>
            <legend className="cartridge-title-text ms-2 px-1">{selectedCartridge.name}</legend>
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
                            <span><VideogameAssetIcon/></span>
                            <span>Play Now</span>
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
                </div>

                <div className="basis-3/4 flex flex-col py-2 max-h-full">
                    <Tab.Group>
                        <Tab.List className="game-option-tabs-header">
                        {tabs.map((tab) => (
                            <Tab
                            key={tab.id}
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span>{tab.label.icon} {tab.label.text}</span>
                            </Tab>
                        ))}
                        </Tab.List>
                        <Tab.Panels className="mt-2 pr-1 overflow-auto custom-scrollbar">
                        {Object.values(tabs).map((item, idx) => (
                            <Tab.Panel
                            key={idx}
                            className="game-tab-content"
                            >
                                <p>
                                {item.content}
                                </p>
                            </Tab.Panel>
                        ))}
                        </Tab.Panels>
                    </Tab.Group>
                </div>
            </div>
        </fieldset>
    )
}

export default CartridgeInfo