"use client"


import React, { Suspense, useContext } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PublishIcon from '@mui/icons-material/Publish';
import DownloadIcon from '@mui/icons-material/Download';
import { Tab } from '@headlessui/react'
import { Canvas } from '@react-three/fiber';
import DescriptionIcon from '@mui/icons-material/Description';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import StadiumIcon from '@mui/icons-material/Stadium';
import CodeIcon from '@mui/icons-material/Code';

import Cartridge from "../models/cartridge";
import {SciFiPedestal} from "../models/scifi_pedestal";
import Loader from "../components/Loader";

function CartridgeInfo() {
    const {selectedCartridge, playCartridge} = useContext(selectedCartridgeContext);

    if (!selectedCartridge) return <></>;

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

                    <div className="flex flex-wrap place-content-evenly">
                        <button className="button-57" onClick={() => {playCartridge()}}>
                            <span><PlayArrowIcon/></span>
                            <span>Play</span>
                        </button>

                        <button className="button-57">
                            <span><PublishIcon/></span>
                            <span>Submit Log</span>
                        </button>

                        <button className="button-57">
                            <span><DownloadIcon/></span>
                            <span>Download Cartridge</span>
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