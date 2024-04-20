"use client"


import { useEffect, useState } from "react";
import { CartridgeInfo, VerificationOutput } from "../backend-libs/core/ifaces";
import { cartridgeInfo, getOutputs } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import { getTapesGifs } from "../utils/util";
import Image from "next/image";
import Link from "next/link";

async function getTapes(current_page:number) {
  const verificationOutputs:Array<VerificationOutput> = await getOutputs(
    {
        tags: ["score"]
    },
    {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
  );

  return verificationOutputs;
}

async function getGameInfo(cartridge_id:string) {
  const cartridgeWithInfo:CartridgeInfo = await cartridgeInfo({id:cartridge_id},{decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"});

  return cartridgeWithInfo;
}

function showTapeInfo(id:string) {
  document.getElementById(id)?.classList.remove("opacity-0");
}

function hideTapeInfo(id:string) {
  document.getElementById(id)?.classList.add("opacity-0");
}


export default function Tapes() {
  const [verificationOutputs, setVerificationOutputs] = useState<Array<VerificationOutput>|null>(null);
  const [gifs, setGifs] = useState<Array<string>|null>(null);
  const [currentPage, setCurrentPage] = useState(0)
  const [cartridgeMap, setCartridgeMap] = useState<Record<string, CartridgeInfo>>({});

  useEffect(() => {
    getTapes(currentPage).then(async (result) => {
      setVerificationOutputs(result)
      let tapes:Set<string> = new Set();
      let idToInfoMap:Record<string, CartridgeInfo> = {};
      result.map(async (verificationOutput) => {
        tapes.add(verificationOutput.tape_hash.slice(2))
        if (!idToInfoMap[verificationOutput.tape_hash]) {
          idToInfoMap[verificationOutput.cartridge_id.slice(2)] = await getGameInfo(verificationOutput.cartridge_id.slice(2));
        }
      });
      setCartridgeMap(idToInfoMap);
      getTapesGifs(Array.from(tapes)).then(setGifs);
    });
  }, [])

  if (!verificationOutputs || !gifs) {
    return (
      <main className="flex items-center justify-center h-lvh text-white">
        Fetching Tapes
      </main>
    )
  }

  if (verificationOutputs.length == 0) {
    return (
      <main className="flex items-center justify-center h-lvh text-white">
        No Tapes Found
      </main>
    )
  }


  return (
    <main className="flex justify-center h-lvh">
      <section className="py-16 my-8 w-full flex justify-center">
        <div className="grid grid-cols-4 space-x-4">
          {
            verificationOutputs.map((verificationOutput, index) => {
              const cartridgeName = cartridgeMap[verificationOutput.cartridge_id.slice(2)].name;
              const user = verificationOutput.user_address;
              const player = `${user.slice(0, 6)}...${user.substring(user.length-4,user.length)}`;
              const timestamp = new Date(verificationOutput.timestamp*1000).toLocaleDateString();
              
              return (
                <Link key={index} href={`/tapes/${verificationOutput.tape_hash.slice(2)}`}>
                  <div 
                    id={verificationOutput.tape_hash}
                    className="absolute w-64 h-64 opacity-0 text-white"
                    onMouseOver={() => showTapeInfo(verificationOutput.tape_hash)}
                    onMouseOut={() => hideTapeInfo(verificationOutput.tape_hash)}
                  >
                    <div className="text-center p-2 h-fit bg-black bg-opacity-10 flex flex-col">
                      <span className="text-sm">{cartridgeName}</span>
                      <span className="text-xs">Score: {verificationOutput.score.toString()}</span>
                    </div>

                    <div className="absolute bottom-0 text-center w-64 p-2 text-[8px] h-fit bg-black bg-opacity-10">{player} on {timestamp}</div>
                  </div>
                  <Image className="border border-black" width={256} height={256} src={"data:image/gif;base64,"+gifs[index]} alt={"Not found"}/>
                </Link>
              )
               
            })
          }
        </div>
      </section>
    </main>
  )
}
