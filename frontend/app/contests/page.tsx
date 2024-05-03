import { envClient } from "@/app/utils/clientEnv";
import { CartridgeInfo, GetRulesPayload, RuleInfo } from "../backend-libs/core/ifaces";
import { cartridgeInfo, rules } from "../backend-libs/core/lib";
import { Contest, ContestStatus, getContestStatus, getContestStatusMessage } from "../utils/common";
import Link from "next/link";
import Image from "next/image";

interface RuleWithMetadata extends RuleInfo, Contest {}

const getRules = async (contests:Record<string,Contest>, onlyActive = false) => {
  const contestsRules:Array<RuleWithMetadata> = [];

  const inputPayload: GetRulesPayload = {
    ids: Object.keys(contests)
  };
  if (onlyActive) {
    inputPayload.active_ts = Math.floor((new Date()).valueOf()/1000);
  }
  
  const activeRules = (await rules(inputPayload, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true})).data
  for (let i = 0; i < activeRules.length; i++) {
    const rule: RuleInfo = activeRules[i];
    if (rule.id in contests) {
      const ruleWithMetadata = {...contests[rule.id], ...rule};
      contestsRules.push(ruleWithMetadata);
    }
  }

  return contestsRules;
}

export default async function Contests() {
  const contestsMetadata = envClient.CONTESTS as Record<string,Contest>;
  const contests = await getRules(contestsMetadata);
  let cartridgeInfoMap:Record<string, CartridgeInfo> = {};
  
  if (contests.length == 0) {
    return (
      <main className="flex items-center justify-center h-lvh">
        <span className={`text-4xl text-white` }>No Active Contests!</span>
      </main>
    )
  }
  
  // get cartridgeInfo
  for (let i = 0; i < contests.length; i++) {
    if (!cartridgeInfoMap[contests[i].cartridge_id]) {
      const cartridge:CartridgeInfo = await cartridgeInfo(
        {id:contests[i].cartridge_id},
        {decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"}
      );

      cartridgeInfoMap[cartridge.id] = cartridge;
    }
  }

  // const currDate = new Date().getTime()/1000; // divide by 1000 to convert from miliseconds to seconds


  return (
    <main>
      <section className="py-16 my-8 w-full flex justify-center">
        <div className="flex flex-col space-y-8 w-full sm:max-w-xl lg:max-w-3xl xl:max-w-5xl">
          {
            contests.map((contest, index) => {
              if (!contest.start || !contest.end) return <></>;
              return (
                <Link key={index} href={`/contest/${contest.id}`}
                  className="bg-gray-400 flex flex-wrap justify-between p-4 border-2 border-transparent hover:border-white"
                >
    
                  <div className="flex flex-col justify-center">
                    <Image alt={"Cover " + cartridgeInfoMap[contest.cartridge_id].name}
                      id="canvas-cover"
                      width={120}
                      height={120}
                      objectFit='contain'
                      style={{
                          imageRendering: "pixelated",
                      }}
                      src={cartridgeInfoMap[contest.cartridge_id].cover? `data:image/png;base64,${cartridgeInfoMap[contest.cartridge_id].cover}`:"/logo.png"}
                      />
                  </div>

                  <div className="flex flex-col relative justify-center">
                    <span className="text-2xl">{contest.name}</span>
                    {/* <span className="text-[10px] opacity-60">{new Date(contest.start*1000).toLocaleString()} until {new Date((contest.end*1000)).toLocaleString()}</span> */}
                  
                    {/* <span className={"absolute bottom-0 right-0 " }>{ConstestStatus[getContestStatus(contest)]}</span> */}
                  </div>

                  <div className="flex flex-col justify-center">
                    <span>Prize: {contest.prize}</span>
                    {/* <span>Tapes: {contest.n_tapes}</span> */}
                    <span>Winner: {contest.winner? contest.winner: "TBA"}</span>
                    <span>Status: {getContestStatusMessage(getContestStatus(contest))}</span>
                  </div>

                  {/* <Link href={`/play/rule/${contest.id}`} className="btn flex items-center"
                    style={{
                      pointerEvents: currDate >= contest.created_at && currDate < contest.end ? "auto":"none",
                    }}>
                    PLAY
                  </Link> */}

                </Link>
              )
            })
          }
        </div>
      </section>
    </main>
  )
}
