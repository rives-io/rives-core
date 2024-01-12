"use client"

import { useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import DescriptionIcon from '@mui/icons-material/Description';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import StadiumIcon from '@mui/icons-material/Stadium';
import CodeIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PublishIcon from '@mui/icons-material/Publish';
import DownloadIcon from '@mui/icons-material/Download';
import { Tab } from '@headlessui/react'

import Cartridge from "../models/cartridge";
import {SciFiPedestal} from "../models/scifi_pedestal";
import Loader from "../components/Loader";
import Title from "../components/Title";

const desc = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam malesuada arcu ex, vitae gravida felis vestibulum ut.
Morbi congue, est ut dictum dignissim, lacus nibh laoreet est, in molestie metus massa eget nisi. In finibus eu massa vitae mattis.
Quisque iaculis eros vitae diam consectetur accumsan.`


const cartridges = [
	{id: 0, name: "Castlevania", cover: "nes_castlevania_cover.jpeg", date: "01/08/2024", desc: "Castlevania #"+desc},
	{id: 1, name: "Life Force",cover: "nes_lifeForce_cover.jpg", date: "01/08/2024", desc: "Life Force #"+desc},
	{id: 2, name: "The Legend of Zelda", cover: "nes_thelegendofzelda_cover.jpg", date: "01/08/2024", desc: "The Legend of Zelda #"+desc},
	{id: 3, name: "Castlevania", cover: "nes_castlevania_cover.jpeg", date: "01/08/2024", desc: "Castlevania #"+desc},
	{id: 4, name: "Life Force",cover: "nes_lifeForce_cover.jpg", date: "01/08/2024", desc: "Life Force #"+desc},
	{id: 5, name: "The Legend of Zelda", cover: "nes_thelegendofzelda_cover.jpg", date: "01/08/2024", desc: "The Legend of Zelda #"+desc},
	{id: 6, name: "Castlevania", cover: "nes_castlevania_cover.jpeg", date: "01/08/2024", desc: "Castlevania #"+desc},
	{id: 7, name: "Life Force",cover: "nes_lifeForce_cover.jpg", date: "01/08/2024", desc: "Life Force #"+desc},
	{id: 8, name: "The Legend of Zelda", cover: "nes_thelegendofzelda_cover.jpg", date: "01/08/2024", desc: "The Legend of Zelda #"+desc},
	{id: 9, name: "Castlevania", cover: "nes_castlevania_cover.jpeg", date: "01/08/2024", desc: "Castlevania #"+desc},
	{id: 10, name: "Life Force",cover: "nes_lifeForce_cover.jpg", date: "01/08/2024", desc: "Life Force #"+desc},
	{id: 11, name: "The Legend of Zelda", cover: "nes_thelegendofzelda_cover.jpg", date: "01/08/2024", desc: "The Legend of Zelda #"+desc},
	{id: 12, name: "Castlevania", cover: "nes_castlevania_cover.jpeg", date: "01/08/2024", desc: "Castlevania #"+desc},
	{id: 13, name: "Life Force",cover: "nes_lifeForce_cover.jpg", date: "01/08/2024", desc: "Life Force #"+desc},
	{id: 14, name: "The Legend of Zelda", cover: "nes_thelegendofzelda_cover.jpg", date: "01/08/2024", desc: "The Legend of Zelda #"+desc}
];

type Cartridge = {
	id: number,
	name: string,
	cover: string,
	desc: string
}

export default function Cartridges() {
    const [selectedCartridge, setSelectedCartridge] = useState<Cartridge|null>(null);
	const selectedCartridgeId = selectedCartridge? selectedCartridge.id: -1;
	const tabs = [
		{
			id: 0,
			label: {icon: <DescriptionIcon/>, text: "Description"},
			content: selectedCartridge?selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc+selectedCartridge.desc:""
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


	const handleCartridgeSelection = (e:React.MouseEvent<HTMLElement>) => {
		const game_id = parseInt((e.target as HTMLInputElement).value);
		setSelectedCartridge(cartridges[game_id]);
	}

    return (
      <main className="">
		<section id="cartridges-section" className="first-section">
			<div className="basis-1/3 justify-self-center flex flex-col">
				<div className="">
					<Title />
				</div>

				<div className="p-4 break-words overflow-auto custom-scrollbar">
					<ul className="">
						{
							!cartridges?
								<Loader/>
							:
								cartridges.map((cartridge, index) => {
									return (
										<li key={`${cartridge.name}-${index}`} className="flex">
											<button className={
												selectedCartridgeId==cartridge.id?
													"games-list-item games-list-selected-item"
												:
													"games-list-item"
												} value={cartridge.id} onClick={handleCartridgeSelection}>

												{cartridge.name}
											</button>
										</li>
									);
							})
						}
					</ul>

				</div>

			</div>


			{
				!selectedCartridge?
					<></>
				:
				<fieldset className="basis-3/5 rounded-md custom-shadow h-full">
  					<legend className="cartridge-title-text ms-2 px-1">{selectedCartridge.name}</legend>
					  <div className="flex flex-row h-full">
						<div className="basis-1/4 h-1/2">
							<Canvas shadows className={!selectedCartridge?"":"xcanvas-3d"} camera={ {near: 0.1, far: 1000, position: [0,0,0]} }>

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

									{
										!selectedCartridge?
											<></>
										:
										(
											<>
												<Cartridge
												rotation={[0, -Math.PI/2, 0]}
													key={selectedCartridge.cover}
													position={[0,0,-10]}
													cover={selectedCartridge.cover}
													scale={[1, 1, 1]}
												/>
												<SciFiPedestal position={[0, -5, -10]} scale={[0.3,0.3,0.3]}/>
											</>
										)
									}


								</Suspense>

							</Canvas>

							<div className="flex flex-wrap place-content-evenly">
								<button className="button-57">
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

			}
		</section>
      </main>
    )
  }
