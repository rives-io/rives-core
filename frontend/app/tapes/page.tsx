"use client"


import { useEffect, useState } from "react";
import { CartridgeInfo, VerificationOutput } from "../backend-libs/core/ifaces";
import { cartridgeInfo, getOutputs } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import { getTapesGifs } from "../utils/util";
import Image from "next/image";
import Link from "next/link";


interface TapesRequest {
  currentPage:number,
  pageSize:number,
  atEnd:boolean,
  orderBy?:string,  
  cartridge?:string // can be used to filter by cartridge
}


async function getTapes(options:TapesRequest) {
  const verificationOutputs:Array<VerificationOutput> = await getOutputs(
    {
        tags: ["score"],
        page: options.currentPage,
        page_size: options.pageSize,
        order_by: "timestamp",
        order_dir: "desc"
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
  const [verificationOutputs, setVerificationOutputs] = useState<Array<VerificationOutput>>([]);
  const [gifs, setGifs] = useState<Array<string>>([]);
  const [cartridgeInfoMap, setCartridgeInfoMap] = useState<Record<string, CartridgeInfo>>({});
  const [tapesRequestOptions, setTapesRequestOptions] = useState<TapesRequest>({currentPage: 1, pageSize: 12, atEnd: false})
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const getFirstPage = async () => {
      await nextPage();
      setFetching(false);
    }

    getFirstPage();
  }, [])

  if (typeof window !== "undefined") {
    window.onscroll = function(ev) {
      if ((window.innerHeight + Math.round(window.scrollY)) >= document.body.offsetHeight) {
        console.log("bottom of the page");
        nextPage();
      }
    };  
  }

  async function nextPage() {
    if (tapesRequestOptions.atEnd) return;
    const tapesOutputs = await getTapes(tapesRequestOptions);
    
    // no more tapes to get
    if (tapesOutputs.length == 0) {
      setTapesRequestOptions({...tapesRequestOptions, atEnd: true});
      return;
    }

    setVerificationOutputs([...verificationOutputs, ...tapesOutputs]);
    let tapes:Set<string> = new Set();
    let idToInfoMap:Record<string, CartridgeInfo> = {};

    for (let i = 0; i < tapesOutputs.length; i++) {
      const tapeOutput = tapesOutputs[i];

      tapes.add(tapeOutput.tape_hash.slice(2));
      if (! (cartridgeInfoMap[tapeOutput.cartridge_id] || idToInfoMap[tapeOutput.cartridge_id])) {
        idToInfoMap[tapeOutput.cartridge_id] = await getGameInfo(tapeOutput.cartridge_id.slice(2));
      }
    }

    if (Object.keys(idToInfoMap).length > 0) setCartridgeInfoMap({...cartridgeInfoMap, ...idToInfoMap});

    const newGifs = await getTapesGifs(Array.from(tapes));
    setGifs([...gifs, ...newGifs]);

    setTapesRequestOptions({...tapesRequestOptions, currentPage: tapesRequestOptions.currentPage+1})
  }

  if (fetching && tapesRequestOptions.currentPage == 0) {
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
    <main>
      <section className="py-16 my-8 w-full flex justify-center">
        <div className="grid grid-cols-4 gap-4">
          {
            verificationOutputs.map((verificationOutput, index) => {
              const cartridgeName = cartridgeInfoMap[verificationOutput.cartridge_id]?.name;
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
                    <div className="text-center p-2 h-fit bg-black bg-opacity-50 flex flex-col">
                      <span className="text-sm">{cartridgeName}</span>
                      <span className="text-xs">Score: {verificationOutput.score.toString()}</span>
                    </div>

                    <div className="absolute bottom-0 text-center w-64 p-2 text-[8px] h-fit bg-black bg-opacity-50">{player} on {timestamp}</div>
                  </div>
                  <Image className="border border-black" width={256} height={256} src={"data:image/gif;base64,"+gifs[index]} alt={"Not found"}/>
                </Link>
              )
               
            })
          }
        </div >
      </section>
    </main>
  )
}
