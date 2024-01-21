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
import CartridgeDescription from './CartridgeDescription';
import Link from 'next/link';
import CartridgeScoreboard from './CartridgeScoreboard';


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
    const {selectedCartridge, playCartridge} = useContext(selectedCartridgeContext);

    if (!selectedCartridge) return <></>;

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