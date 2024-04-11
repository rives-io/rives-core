import { ScoreboardInfo } from "@/app/backend-libs/app/ifaces";
import ContestInfo from "@/app/components/ContestInfo";
import { delay } from "@/app/utils/util";
import Link from "next/link";


const getScoreboard = async (scoreboard_id:string) => {
  await delay(2000);
  let scoreboard:ScoreboardInfo = {
      args: "",
      cartridge_id: "bce46ba409378be140598c80bc2cc7f186aed3de1d05b31918376dd06e3b6fdf",
      created_at: 1712187277,
      created_by: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      id: "0",
      in_card:"",
      name: "Contest Name",
      score_function: ""
  }

  return scoreboard;
}

export default async function Contest({ params }: { params: { contest_id: string } }) {
  const contest_id = params.contest_id;
  const currDate = new Date();

  const contest = await getScoreboard(contest_id);

  return (
      <main className="flex justify-center h-svh">
        <section className="py-16 my-8 w-full flex flex-col space-y-8 max-w-5xl h-2/3">
          <div className="bg-gray-400 flex flex-wrap justify-between p-4">
            
            <div className="flex flex-col">
              <span className="text-2xl">{contest.name}</span>
              <span className="text-[10px] opacity-60">{new Date(contest.created_at*1000).toLocaleString()} until {new Date((contest.created_at*1000)+(86400*1000)).toLocaleString()}</span>
            </div>

            <div className="flex flex-col">
              <span>Prize: $1000</span>
              <span>Winner: TBA</span>
            </div>

            <Link href={`/play?=${contest.id}`} className="btn"
              style={{
                pointerEvents: (currDate > new Date((contest.created_at*1000)+(86400*1000))) ? "none" : "auto",
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