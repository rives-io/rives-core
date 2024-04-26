import { envClient } from "@/app/utils/clientEnv";
import { Contest } from "../contest/[contest_id]/page";
import { CartridgeInfo, RuleInfo } from "../backend-libs/core/ifaces";
import { cartridgeInfo, rules } from "../backend-libs/core/lib";
import Link from "next/link";
import { formatDate } from "../utils/util";

interface RuleWithMetadata extends RuleInfo, Contest {}

const getRules = async (contestList:Array<Contest>) => {
  const contestsRules:Array<RuleWithMetadata> = [];
  
  for (let i = 0; i < contestList.length; i++) {
    const rule = (await rules({id: contestList[i].rule_id}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true})).data;

    if (rule.length > 0) {
      const ruleWithMetadata = {...contestList[i], ...rule[0]}
      contestsRules.push(ruleWithMetadata);
    }
  }

  return contestsRules;
}

export default async function Contests() {
  const contestsMetadataList = envClient.CONTESTS as Array<Contest>;
  const contests = await getRules(contestsMetadataList);
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
              return (
                <Link key={index} href={`/contest/${contest.id}`}
                  className="bg-gray-400 flex flex-wrap justify-between p-4 border-2 border-transparent hover:border-white"
                >
    
                  <div className="flex flex-col">
                    <span className="text-2xl">{contest.name}</span>
                    <div className="flex flex-col text-[10px] opacity-60 w-fit">
                      <span>{formatDate(new Date(contest.created_at*1000))}</span>
                      <span className="place-self-center">until</span>
                      <span>{formatDate(new Date((contest.end*1000)))}</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span>Game: {cartridgeInfoMap[contest.cartridge_id].name}</span>
                    <span>Prize: {contest.prize}</span>
                    <span>Winner: {contest.winner? contest.winner: "TBA"}</span>
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
