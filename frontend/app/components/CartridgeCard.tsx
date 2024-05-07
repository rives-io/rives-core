"use client"



import Image from "next/image";
import { CartridgeInfo } from "../backend-libs/core/ifaces"
import { cartridgeInfo } from "@/app/backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import RivesLogo from "./svg/RivesLogo";
import { useContext } from "react";
import { selectedCartridgeContext } from "../cartridges/selectedCartridgeProvider";



export default function CartridgeCard({cartridge}:{cartridge:CartridgeInfo}) {
    const {changeCartridge, fetchingCartridgeInfo} = useContext(selectedCartridgeContext);
    
    const handleCartridgeSelection = async (e:React.MouseEvent<HTMLElement>) => {
        fetchingCartridgeInfo();
        const cartridgeWithInfo:CartridgeInfo = await cartridgeInfo({id:cartridge.id}, {decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"})
		changeCartridge(cartridgeWithInfo);
	}

    return (
        <button className="w-48 h-64 grid grid-cols-1 p-2 bg-gray-400 hover:bg-rives-purple text-start" onClick={handleCartridgeSelection}>
            <RivesLogo className="place-self-start" style={{width:50}}/>
            
            <div className="w-fill h-36 bg-black relative">
                <Image fill 
                src={"data:image/png;base64,"+cartridge.cover} alt={"Not found"}/>
            </div>

            <div className="p-1 place-self-end bg-gray-600 flex flex-col text-white w-full h-16">
                <span className="text-sm">
                    {cartridge.name}
                </span>

                {
                    cartridge.authors.length > 0?
                        <span title={cartridge.authors.toString()} className="text-[8px] break-words">
                            By
                            {
                                cartridge.authors.map((author, index) => {
                                    const authors_length = cartridge.authors.length;
                                    return (
                                            ` ${author}${index != authors_length-1? ",":""}`
                                    )
                                })
                            }
                        </span>
                    :
                        <></>
                }

            </div>
        </button>
    )
}