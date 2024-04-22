import { cartridgeInfo, rules } from "@/app/backend-libs/core/lib";
import { CartridgeInfo, RuleInfo } from "@/app/backend-libs/core/ifaces";
import ContestInfo from "@/app/components/ContestInfo";
import { envClient } from "@/app/utils/clientEnv";
import Link from "next/link";
import { notFound } from "next/navigation";


export interface Contest {
  rule_id:string,
  start:number,
  end:number,
  prize:string,
  winner?:string
}

const getContest = (rule_id:string) => {
  const contestList = envClient.CONTESTS as Array<Contest>;

  for (let i = 0; i < contestList.length; i++) {
    const contest = contestList[i];
    if (contest.rule_id == rule_id) {
      return contest;
    }
  }

  return null;
}

const getRule = async(rule_id:string):Promise<RuleInfo|null> => {
  const rulesFound = (await rules({id: rule_id}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true})).data;

  if (rulesFound.length == 0) return null;

  return rulesFound[0];
}

async function getGameInfo(cartridge_id:string) {
  const cartridgeWithInfo:CartridgeInfo = await cartridgeInfo({id:cartridge_id},{decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"});

  return cartridgeWithInfo;
}

export default async function Contest({ params }: { params: { contest_id: string } }) {
  const contest_id = params.contest_id;

  const contestMetadata = getContest(contest_id);

  if (!contestMetadata) {
    notFound();
  }

  const contest = await getRule(contest_id);
  if (!contest) {
    notFound();
  }

  const currDate = new Date().getTime()/1000; // divide by 1000 to convert from miliseconds to seconds
  const contestIsOpen = currDate >= contest.created_at && currDate < contestMetadata.end;
  const game = await getGameInfo(contest.cartridge_id);

  return (
      <main className="flex justify-center h-svh">
        <section className="py-16 my-8 w-full flex flex-col space-y-8 max-w-5xl h-2/3">
          <div className="bg-gray-400 flex flex-wrap justify-between p-4">
            
            <div className="flex flex-col">
              <span className="text-2xl">{contest.name}</span>
              <span className="text-[10px] opacity-60">{new Date(contest.created_at*1000).toLocaleString()} until {new Date((contestMetadata.end*1000)).toLocaleString()}</span>
            </div>

            <div className="flex flex-col">
              <span>Game: {game.name}</span>
              <span>Prize: {contestMetadata.prize}</span>
              <span>Winner: {contestMetadata.winner? contestMetadata.winner: "TBA"}</span>
            </div>

            <Link href={`/play/rule/${contest.id}`} className="btn flex items-center"
              style={{
                pointerEvents: contestIsOpen ? "auto":"none",
              }}>
              PLAY
            </Link>

          </div>

          <div className="flex h-full">
            <ContestInfo contest={contest}></ContestInfo>
          </div>
        </section>
      </main>
    )
}