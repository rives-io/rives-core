"use client"

import { ethers } from "ethers";
import { VerificationOutput,VerifyPayload,cartridge, getOutputs } from '@/app/backend-libs/core/lib';
import { envClient } from '@/app/utils/clientEnv';
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from '@/app/components/RivemuPlayer';


const getScoreInfo = async (tapeId:string):Promise<VerificationOutput> => {
    const scores:Array<VerificationOutput> = await getOutputs(
        {
            tags: ["score",tapeId],
        }, {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );

    if (scores.length === 0) throw new Error(`Verification output not found for tape ${tapeId}!`);
    
    return scores[0];
}

const getCartridgeData = async (cartridgeId:string) => {
    const formatedCartridgeId = cartridgeId.slice(2);
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
    
    if (data.length === 0) throw new Error(`Tape ${formatedCartridgeId} not found!`);
    
    return data;
}


const getTapePayload = async (tapeId:string):Promise<VerifyPayload> => {
    const replayLogs:Array<VerifyPayload> = await getOutputs(
        {
            tags: ["tape",tapeId],
            type: 'input'
        },
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );
    console.log(replayLogs[0])
    return replayLogs[0];
}


export default async function Tape({ params }: { params: { tape_id: string } }) {
    
    // // state managing
    // const [scoreInfo, setScoreInfo] = useState<VerificationOutput|null>(null)
    // const [cartridgeData, setCartridgeData] = useState<Uint8Array|null>(null)
    // const [tape, setTape] = useState<Uint8Array|null>(null)
    // const [error, setError] = useState<String|null>(null);

    // // riv state
    // const [currScore, setCurrScore] = useState(0);
    // const [playing, setPlaying] = useState({isPlaying: false, playCounter: 0})

    
    let errorMsg:string|null = null;
    let scoreInfo:VerificationOutput|null = null;
    let cartridgeData:Uint8Array|null = null;
    let tape:Uint8Array|null = null;
    
    try {
        scoreInfo = await getScoreInfo(params.tape_id);
        cartridgeData = await getCartridgeData(scoreInfo.cartridge_id);
        
        const tapePayload = await getTapePayload(params.tape_id);
        const tapeData = tapePayload.tape;
        if (typeof tapeData != "string" || !ethers.utils.isHexString(tapeData))
            throw new Error("Corrupted tape");
        tape = ethers.utils.arrayify(tapeData);
        
    } catch (error) {
        errorMsg = (error as Error).message;
    }

    // useEffect(() => {
    //     getScoreInfo(params.tape_id)
    //     .then((score) => {
    //         setScoreInfo(score);
    //         getCartridgeData(score.cartridge_id)
    //         .then(setCartridgeData)
    //         .catch((error) => setError((error as Error).message));
    //     })
    //     .catch((error) => setError((error as Error).message));
    // }, [])

    // useEffect(() => {
    //     getTape(params.tape_id).then(setTape);
    // }, [cartridgeData])


    // BEGIN: error and feedback handling
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

    if (!scoreInfo) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Info...
            </main>
        )
    }

    if (!cartridgeData) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Cartridge...
            </main>
        )
    }

    if (!tape) {
        return (
            <main className="flex items-center justify-center h-lvh text-white">
                Getting Tape...
            </main>
        )
    }
    // END: error and feedback handling


    return (
        <main className="flex items-center justify-center h-lvh">
            <RivemuPlayer cartridgeData={cartridgeData} args='' in_card={new Uint8Array([])} scoreFunction='' tape={tape} />
        </main>
    )
}

