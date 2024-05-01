import { cartridgeInfo, rules } from "@/app/backend-libs/core/lib";
import { CartridgeInfo, RuleInfo } from "@/app/backend-libs/core/ifaces";
import ContestInfo from "@/app/components/ContestInfo";
import { envClient } from "@/app/utils/clientEnv";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Contest as ContestClass, ContestStatus, getContestStatus } from "../../utils/common";
import Image from "next/image";


const getContest = (rule_id:string) => {
  const contests = envClient.CONTESTS as Record<string,ContestClass>;

  if (rule_id in contests) {
    return contests[rule_id];
  }

  return null;
}

const getRule = async(rule_id:string):Promise<RuleInfo|null> => {
  const rulesFound = (await rules({id: rule_id}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true,cache:"reload"})).data;

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

  const contestIsOpen = getContestStatus(contest) == ContestStatus.IN_PROGRESS;
  const game = await getGameInfo(contest.cartridge_id);

  return (
      <main className="flex justify-center h-svh">
        <section className="py-16 my-8 w-full flex flex-col space-y-8 max-w-5xl h-2/3">
          <div className="bg-gray-400 flex justify-between p-4 space-x-2">
            
            <div className="flex flex-col justify-center">
              <Image alt={"Cover " + game.name}
                id="canvas-cover"
                width={120}
                height={120}
                objectFit='contain'
                style={{
                    imageRendering: "pixelated",
                }}
                src={game.cover? `data:image/png;base64,${game.cover}`:"/logo.png"}
                />
            </div>
            <div className="flex flex-col relative justify-center">
              <span className="text-2xl">{contest.name}</span>
              {contest.start && contest.end ? <span title={new Date(contest.start*1000).toLocaleString() + " until " + new Date((contest.end*1000)).toLocaleString()} className="text-[10px] opacity-60">ends {new Date((contest.end*1000)).toLocaleDateString()}</span> : <></>}
              {/* <span className={"absolute bottom-0 right-0 " }>{ContestStatus[getContestStatus(contest)]}</span> */}
            </div>

            <div className="flex flex-col justify-center">
              {/* <span>Game: {game.name}</span> */}
              <span>Prize: {contestMetadata.prize}</span>
              <span>Tapes: {contest.n_tapes}</span>
              <span>Winner: {contestMetadata.winner? contestMetadata.winner: "TBA"}</span>
              <span>{contestIsOpen ? "Status: Open" : "" }</span>
            </div>

            <div className="flex flex-col justify-center">
              <Link href={`/play/rule/${contest.id}`} className="btn"
                style={{
                  pointerEvents: contestIsOpen ? "auto":"none",
                  height:"50px"
                }}>
                PLAY
              </Link>
            </div>

          </div>

          <div className="flex h-full">
            <ContestInfo contest={contest}></ContestInfo>
          </div>
        </section>
      </main>
    )
}