import { VerificationOutput, cartridgeInfo, getOutputs, rules } from "@/app/backend-libs/core/lib";
import { CartridgeInfo, RuleInfo } from "@/app/backend-libs/core/ifaces";
import ContestInfo from "@/app/components/ContestInfo";
import { envClient } from "@/app/utils/clientEnv";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Contest as ContestClass, ContestStatus, getContestStatus, getContestStatusMessage } from "../../utils/common";
import Image from "next/image";
import { indexerQuery } from "@/app/backend-libs/indexer/lib";


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

const getWinner = async (cartridge_id:string, rule:string):Promise<string|undefined> => {
  const tags = ["score",cartridge_id,rule];
  const tapes:Array<VerificationOutput> = await getOutputs(
      {
          tags,
          type: 'notice',
          page_size: 1,
          page: 1,
          order_by: "value",
          order_dir: "desc"
      },
      {cartesiNodeUrl: envClient.CARTESI_NODE_URL});
  console.log(tapes,await indexerQuery(
    {
      tags,
      type: 'notice',
      page_size: 0,
      page: 1,
      order_by: "value",
      order_dir: "desc"
  },
  {cartesiNodeUrl: envClient.CARTESI_NODE_URL, decode: true}
  ))
  if (tapes.length == 0) return undefined
  return tapes[0].user_address
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

  const status = getContestStatus(contest);
  const contestIsOpen = status == ContestStatus.IN_PROGRESS;
  const game = await getGameInfo(contest.cartridge_id);
  console.log(status, ContestStatus[status])
  if (status == ContestStatus.VALIDATED) {
    contestMetadata.winner = await getWinner(contest.cartridge_id,contest_id);
  }

  return (
      <main className="flex justify-center h-svh">
        <section className="py-16 my-8 w-full flex flex-col space-y-8 max-w-5xl h-2/3">
          <div className="bg-gray-400 grid grid-cols-9 gap-2 justify-between p-4">
            
            <div className="flex col-span-1 justify-center items-center">
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
            <div className="flex flex-col col-span-4 relative justify-center">
              <span className="text-2xl">{contest.name}</span>
              {contest.start && contest.end ? <span title={new Date(contest.start*1000).toLocaleString() + " until " + new Date((contest.end*1000)).toLocaleString()} className="text-[10px] opacity-60">ends {new Date((contest.end*1000)).toLocaleDateString()}</span> : <></>}
              {/* <span className={"absolute bottom-0 right-0 " }>{ContestStatus[getContestStatus(contest)]}</span> */}
            </div>

            <div className="flex flex-col col-span-3 justify-center">
              {/* <span>Game: {game.name}</span> */}
              <span>Prize: {contestMetadata.prize}</span>
              <span>Tapes: {contest.n_tapes}</span>
              <span title={contestMetadata.winner}>Winner: {contestMetadata.winner? contestMetadata.winner?.substring(0,6)+"..."+contestMetadata.winner?.substring(contestMetadata.winner?.length-4,contestMetadata.winner?.length): "TBA"}</span>
              <span>Status: {getContestStatusMessage(status)}</span>
            </div>

            <div className="flex col-span-1 justify-right items-center">
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