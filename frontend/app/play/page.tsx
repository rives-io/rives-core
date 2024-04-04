"use client"

import { notFound, useSearchParams } from "next/navigation";
import { ScoreboardInfo } from "../backend-libs/app/ifaces";
import { delay } from "../utils/util";


const getScoreboard = async (scoreboard_id:string) => {
    await delay(2000);
    let scoreboard:ScoreboardInfo = {
        args: "",
        cartridge_id: "",
        created_at: 0,
        created_by: "0x...",
        id: "",
        in_card:"",
        name: "",
        score_function: ""
    }

    return scoreboard;
}

export default async function Play() {
    const searchParams = useSearchParams();

    const url_scoreboard_id = searchParams.get("scoreboard-id");
    const url_cartridge_id = searchParams.get("cartridge-id");

    if (!(url_scoreboard_id || url_cartridge_id) ) {
        notFound();
    }

    let scoreboard:ScoreboardInfo;
    let cartridge_id:string = url_cartridge_id? url_cartridge_id: "";
    if (url_scoreboard_id) {
        scoreboard = await getScoreboard(url_scoreboard_id);
        cartridge_id = scoreboard.cartridge_id;
    }

    // Rivemu parameters
    const args = "";
    const in_card = "";
    const score_function = "";
  
    return (
        <main className="flex items-center justify-center h-lvh">
          <span className="text-4xl text-white"></span>
        </main>
      )
}