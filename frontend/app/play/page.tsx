import { notFound } from "next/navigation";
import { ScoreboardInfo } from "../backend-libs/app/ifaces";
import { delay } from "../utils/util";
import { cartridge } from "../backend-libs/app/lib";
import { envClient } from "../utils/clientEnv";
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from '@/app/components/RivemuPlayer';


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

const getCartridgeData = async (cartridgeId:string) => {
    const formatedCartridgeId = cartridgeId.substring(0, 2) === "0x"? cartridgeId.slice(2): cartridgeId;
    const data = await cartridge(
        {
            id:formatedCartridgeId
        },
        {
            decode:true,
            decodeModel:"bytes",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    
    if (data.length === 0) throw new Error(`Cartridge ${formatedCartridgeId} not found!`);
    
    return data;
}

export default async function Play({searchParams}:{searchParams: {[key: string]: string | string[] | undefined}}) {
    const url_scoreboard_id = searchParams["scoreboard-id"];
    const url_cartridge_id = searchParams["cartridge-id"];

    if (!(url_scoreboard_id || url_cartridge_id) ) {
        notFound();
    }

    if (Array.isArray(url_scoreboard_id) || Array.isArray(url_cartridge_id)) {
        notFound();
    }

    let scoreboard:ScoreboardInfo|null = null;
    let cartridge_id:string = url_cartridge_id? url_cartridge_id: "";
    if (url_scoreboard_id) {
        scoreboard = await getScoreboard(url_scoreboard_id);
        cartridge_id = scoreboard.cartridge_id;
    }

    // Rivemu parameters
    const args = scoreboard?.args || "";
    const in_card = scoreboard?.in_card? new TextEncoder().encode(scoreboard.in_card): new Uint8Array([]);
    const score_function = scoreboard?.score_function || "";
    let cartridgeData:Uint8Array|null = null;

    let errorMsg:string|null = null;
    try {
        cartridgeData = await getCartridgeData(cartridge_id);
    } catch (error) {
        errorMsg = (error as Error).message;
    }


    if (errorMsg) {
        return (
            <main className="flex items-center justify-center h-lvh">
                <div className='flex w-96 flex-wrap break-all justify-center'>
                    <ReportIcon className='text-red-500 text-5xl' />
                    <span style={{color: 'white'}}> {errorMsg}</span>
                </div>
            </main>
        )
    }

    if (!cartridgeData) {
        return (
            <main className="flex items-center justify-center h-lvh">
                Getting Cartridge...
            </main>
        )
    }

  
    return (
        <main className="flex items-center justify-center h-lvh">
            <RivemuPlayer cartridgeData={cartridgeData} args={args} in_card={in_card} score_function={score_function} />
        </main>
    )
}