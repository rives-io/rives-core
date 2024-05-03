"use client"


import {  ethers } from "ethers";
import { useEffect, useState } from "react";
import { sha256 } from "js-sha256";
import { CartridgeInfo, RuleInfo } from "../backend-libs/core/ifaces";
import { cartridgeInfo, getOutputs, rules, RulesOutput, VerificationOutput, VerifyPayload } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import { getTapesGifs } from "../utils/util";
import Image from "next/image";
import Link from "next/link";
import { ContestStatus, formatBytes, getContestStatus } from '../utils/common';


interface TapesRequest {
  currentPage:number,
  pageSize:number,
  atEnd:boolean,
  fetching:boolean,
  orderBy?:string,  
  cartridge?:string // can be used to filter by cartridge
}

const DEFAULT_PAGE_SIZE = 12

function getTapeId(tapeHex: string): string {
  return sha256(ethers.utils.arrayify(tapeHex));
}

async function getTapes(options:TapesRequest) {
  const verificationINputs:Array<VerifyPayload> = await getOutputs(
    {
        tags: ["tape"],
        type: 'input',
        page: options.currentPage,
        page_size: options.pageSize,
        order_by: "timestamp",
        order_dir: "desc"
    },
    {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
  );

  return verificationINputs;
}

async function getRuleInfo(rule_id:string) {
  const rulesOutput: RulesOutput = (await rules({id:rule_id}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true,cache:"force-cache"}));
  return rulesOutput.data[0];
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

function loadingFallback() {
  const arr = Array.from(Array(DEFAULT_PAGE_SIZE).keys());
  return (
    <>
      {
        arr.map((val, index) => {
          return (
            <div key={index} className="w-64 h-64 grid grid-cols-1 place-content-center bg-black animate-pulse"></div>
          )
        })
      }
    </>
  )
}

export default function Tapes() {
  const [verificationInputs, setVerificationInputs] = useState<Array<VerifyPayload>|null>(null);
  const [gifs, setGifs] = useState<Array<string>>([]);
  const [cartridgeInfoMap, setCartridgeInfoMap] = useState<Record<string, CartridgeInfo>>({});
  const [ruleInfoMap, setRuleInfoMap] = useState<Record<string, RuleInfo>>({});
  const [tapesRequestOptions, setTapesRequestOptions] = useState<TapesRequest>({currentPage: 1, pageSize: DEFAULT_PAGE_SIZE, atEnd: false, fetching: false})
  const [scores, setScores] = useState<Record<string, number|undefined>>({});

  useEffect(() => {
    const getFirstPage = async () => {
      await nextPage();
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
    if (tapesRequestOptions.fetching || tapesRequestOptions.atEnd) return;

    setTapesRequestOptions({...tapesRequestOptions, fetching: true});
    const tapesInputs = await getTapes(tapesRequestOptions);
    
    // no more tapes to get
    if (tapesInputs.length == 0) {
      setTapesRequestOptions({...tapesRequestOptions, atEnd: true, fetching: false});
      return;
    }

    if (!verificationInputs) {
      setVerificationInputs(tapesInputs);
    } else {
      setVerificationInputs([...verificationInputs, ...tapesInputs]);
    }
    let tapes:Set<string> = new Set();
    let idToInfoMap:Record<string, CartridgeInfo> = {};
    let idToRuleInfoMap:Record<string, RuleInfo> = {};

    for (let i = 0; i < tapesInputs.length; i++) {
      const tapeInput: VerifyPayload = tapesInputs[i];

      tapes.add(getTapeId(tapeInput.tape));
      if (! (cartridgeInfoMap[tapeInput.rule_id] || idToInfoMap[tapeInput.rule_id] || idToRuleInfoMap[tapeInput.rule_id]) ) {

        idToRuleInfoMap[tapeInput.rule_id] = await getRuleInfo(tapeInput.rule_id.slice(2));
        idToInfoMap[tapeInput.rule_id] = await getGameInfo(idToRuleInfoMap[tapeInput.rule_id].cartridge_id);
      }
    }

    if (Object.keys(idToInfoMap).length > 0) setCartridgeInfoMap({...cartridgeInfoMap, ...idToInfoMap});
    if (Object.keys(idToRuleInfoMap).length > 0) setRuleInfoMap({...ruleInfoMap, ...idToRuleInfoMap});

    try {
      const newGifs = await getTapesGifs(Array.from(tapes));
      setGifs([...gifs, ...newGifs]);
    } catch (e) {
      console.log(e)
    }
    setTapesRequestOptions({...tapesRequestOptions, 
      currentPage: tapesRequestOptions.currentPage+1, 
      fetching: false,
      atEnd: tapesInputs.length < tapesRequestOptions.pageSize
    });
  }


  if (verificationInputs?.length == 0) {
    return (
      <main className="flex items-center justify-center h-lvh text-white">
        No Tapes Found
      </main>
    )
  }


  return (
    // h-screen to allow scroll-down
    <main className={!(tapesRequestOptions.atEnd || tapesRequestOptions.fetching)? "h-screen":""}> 
      <section className="py-16 my-8 w-full flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {
            verificationInputs?.map((verificationInput, index) => {
              const cartridgeName = cartridgeInfoMap[verificationInput.rule_id]?.name;
              const ruleName = ruleInfoMap[verificationInput.rule_id]?.name;
              const user = verificationInput._msgSender;
              const player = `${user.slice(0, 6)}...${user.substring(user.length-4,user.length)}`;
              const timestamp = new Date(verificationInput._timestamp*1000).toLocaleDateString();
              const tapeId = getTapeId(verificationInput.tape);
              const size = formatBytes((verificationInput.tape.length -2 )/2);
              if (ruleInfoMap[verificationInput.rule_id] && 
                  [ContestStatus.INVALID,ContestStatus.VALIDATED].indexOf(getContestStatus(ruleInfoMap[verificationInput.rule_id])) > -1) {
                    getOutputs(
                      {
                          tags: ["score",tapeId],
                          type: 'notice'
                      },
                      {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
                    ).then((out: VerificationOutput[]) =>{
                      if(out.length>0){
                        scores[tapeId] = out[0].score;
                        setScores(scores);
                      }
                    });
              }
              
              return (
                <Link key={index} href={`/tapes/${tapeId}`}>
                  <div 
                    id={tapeId}
                    className="absolute w-64 h-64 opacity-0 text-white"
                    onMouseOver={() => showTapeInfo(tapeId)}
                    onMouseOut={() => hideTapeInfo(tapeId)}
                  >
                    <div className="text-center p-2 h-fit bg-black bg-opacity-50 flex flex-col">
                      <span className="text-sm">{cartridgeName}</span>
                      {scores[tapeId] ? <span className="text-xs">Score: {scores[tapeId]?.toString()}</span> : <></>}
                    </div>

                    <div className="absolute bottom-0 text-center w-64 p-2 text-[8px] h-fit bg-black bg-opacity-50">
                      <span>Mode: {ruleName}</span><br />
                      <span>{player} on {timestamp}</span>
                      <span>Size {size}</span>
                    </div>
                  </div>

                  <div className="w-64 h-64 grid grid-cols-1 place-content-center bg-black">
                    <Image className="border border-black" width={256} height={256} src={"data:image/gif;base64,"+(gifs[index] ? gifs[index] :  cartridgeInfoMap[verificationInput.rule_id]?.cover)} alt={"Not found"}/>
                  </div>
                </Link>
              )
               
            })
          }
          {
            tapesRequestOptions.fetching?
              loadingFallback()
            :
              <></>
          }
        </div >
      </section>
    </main>
  )
}
