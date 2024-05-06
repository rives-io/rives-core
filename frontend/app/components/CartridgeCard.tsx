"use client"



import Image from "next/image";
import { CartridgeInfo } from "../backend-libs/core/ifaces"
import { cartridgeInfo } from "@/app/backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import RivesLogo from "./svg/RivesLogo";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { selectedCartridgeContext } from "../cartridges/selectedCartridgeProvider";



export default function CartridgeCard({cartridge}:{cartridge:CartridgeInfo}) {
    const {changeCartridge} = useContext(selectedCartridgeContext);
    const [cartridgeWithCover, setCartridgeWithCover] = useState<CartridgeInfo|null>(null)
    
    const handleCartridgeSelection = async (e:React.MouseEvent<HTMLElement>) => {
		changeCartridge(cartridgeWithCover);
	}

    useEffect(() => {
        cartridgeInfo({id:cartridge.id}, {decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"}).then(setCartridgeWithCover);
    }, [])

    if (!cartridgeWithCover) return <></>;

    return (
        <button className="w-48 h-64 grid grid-cols-1 p-2 bg-gray-400 hover:bg-rives-purple text-start" onClick={handleCartridgeSelection}>
            <RivesLogo className="place-self-start" style={{width:50}}/>
            
            <div className="w-fill h-36 bg-black relative">
                <Image fill 
                src={"data:image/png;base64,"+cartridgeWithCover.cover} alt={"Not found"}/>
            </div>

            <div className="p-1 place-self-end bg-gray-600 flex flex-col text-white w-full h-16">
                <span className="text-sm">
                    {cartridgeWithCover.info?.name}
                </span>

                {
                    cartridgeWithCover.info?.authors?
                        <span title={cartridgeWithCover.info?.authors?.toString()} className="text-[8px]">
                            By
                            {
                                cartridgeWithCover.info?.authors?.map((author, index) => {
                                    const authors_length = cartridgeWithCover.info!.authors!.length;
                                    return (
                                        <Link key={index} onClick={(e) => {e.stopPropagation();}} href={author.link} rel="noopener noreferrer" target="_blank" className="hover:text-[#8b5cf6]">
                                            {` ${author.name}${index != authors_length-1? ",":""}`}
                                        </Link>
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