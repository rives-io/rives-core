import { ReplayScore } from '@/app/backend-libs/app/ifaces';
import { cartridge, getOutputs } from '@/app/backend-libs/app/lib';
import { envClient } from '@/app/utils/clientEnv';
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from '@/app/components/RivemuPlayer';


const getScoreInfo = async (inputIndex:number):Promise<ReplayScore> => {
    const scores:Array<ReplayScore> = await getOutputs(
        {
            tags: ["score"],
            input_index:inputIndex
        }, {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );

    if (scores.length === 0) throw new Error(`Score not found for inputIndex ${inputIndex}!`);
    
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
    
    if (data.length === 0) throw new Error(`Cartridge ${formatedCartridgeId} not found!`);
    
    return data;
}


const getTape = async (inputIndex:number, outputIndex:number):Promise<Uint8Array> => {
    const replayLogs:Array<Uint8Array> = await getOutputs(
        {
            tags: ["replay"],
            input_index: inputIndex,
            output_type: 'report'
        },
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
    );
    
    if (replayLogs.length-1 < outputIndex) {
        console.log("Tape does not exists");
        return new Uint8Array([]);
    }

    return replayLogs[outputIndex];
}


export default async function Tape({ params }: { params: { input_index: String, output_index: String } }) {
    const inputIndex = parseInt(`${params.input_index}`);
    const outputIndex = parseInt(`${params.output_index}`);
    
    let errorMsg:string|null = null;
    let scoreInfo:ReplayScore|null = null;
    let cartridgeData:Uint8Array|null = null;
    let tape:Uint8Array|null = null;
    
    try {
        scoreInfo = await getScoreInfo(inputIndex);
        cartridgeData = await getCartridgeData(scoreInfo.cartridge_id);
        tape = await getTape(inputIndex, outputIndex);
    } catch (error) {
        errorMsg = (error as Error).message;
    }
    

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
            <main className="flex items-center justify-center h-lvh">
                Getting Info...
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

    if (!tape) {
        return (
            <main className="flex items-center justify-center h-lvh">
                Getting Gameplay Tape...
            </main>
        )
    }
    // END: error and feedback handling


    return (
        <main className="flex items-center justify-center h-lvh">
            <RivemuPlayer cartridgeData={cartridgeData} args='' in_card={new Uint8Array([])} score_function='' tape={tape} />
        </main>
    )
}

