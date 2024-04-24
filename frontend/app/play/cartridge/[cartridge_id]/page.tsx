import { envClient } from "@/app/utils/clientEnv";
import PlayPage from "../../../components/PlayPage";
import { RulesOutput, rules } from "@/app/backend-libs/core/lib";
import { InspectReport } from '@/app/backend-libs/cartesapp/utils';
import { RuleInfo } from "@/app/backend-libs/core/ifaces";
import ReportIcon from '@mui/icons-material/Report';

const getCartridgeDefaultRuleID = async (cartridge_id:string) => {
    const reportOutput:InspectReport = await rules(
        {cartridge_id:cartridge_id, name:"default"},
        {cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"}
    );

    const output = new RulesOutput(reportOutput);
    if (output.total.length == 0) throw new Error("Default rule not found.");

    return output.data[0] as RuleInfo;
}

export default async function PlayCartridge({ params }: { params: { cartridge_id: string } }) {
    let defaultRule:RuleInfo|null = null;
    let errorMsg:string|null = null;

    try {
        defaultRule = await getCartridgeDefaultRuleID(params.cartridge_id);
    } catch (error) {
        errorMsg = (error as Error).message;
    }

    if (errorMsg || !defaultRule) {
        return (
            <main className="flex items-center justify-center h-lvh">
                <div className='flex w-96 flex-wrap break-all justify-center'>
                    <ReportIcon className='text-red-500 text-5xl' />
                    <span style={{color: 'white'}}> {errorMsg}</span>
                </div>
            </main>
        )
    }

    return PlayPage({cartridge_id:params.cartridge_id, rule_id: defaultRule.id})
}

