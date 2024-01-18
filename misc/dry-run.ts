
import { ContractReceipt, ethers, } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

import { 
    cartridge, cartridges, cartridgeInfo, createScoreboard, getOutputs
} from "./app/lib"
import { decodeToConventionalTypes } from "./cartesapp/lib"
import { AdvanceOutput } from "cartesi-client";


export const provider = new JsonRpcProvider("http://localhost:8545");

export const dappAddress = "0x70ac08179605AF2D9e75782b8DEcDD3c22aA4D0C".toLowerCase();

const signer = ethers.Wallet
    .fromMnemonic("test test test test test test test test test test test junk",
    `m/44'/60'/0'/0/1`)
    .connect(provider);


interface Person {
    name: string;
    age: number;
    location: string;
}


const cartridge_id = "907ab088197625939b2137998b0efd59f30b3683093733c1ca4e0a62d638e09f";

const cartridgesRun = async () => {

    const d = await cartridges({},{decode:true,decodeModel:"CartridgesOutput"});
    console.log("cartridges");
    console.log(d)
}

const cartridgeInfoRun = async () => {
    const d = await cartridgeInfo({id:cartridge_id},{decode:true,decodeModel:"json"}); // default is json
    console.log("Info");
    console.log(d)
}

const createScoreboardRun = async () => {

    console.log("create Scoreboard");
    
    try {
        const res: AdvanceOutput | ContractReceipt| any[] = await createScoreboard(
            signer,
            dappAddress,
            {cartridge_id:'0x'+cartridge_id,score_function:"score+10*apples",in_card:"0x",name:"Run scoreboard",args:""},
            {decode:true}
        );
        console.log("Scoreboard");
        console.log(res)
        // const out = res as AdvanceOutput;
        // const dec = decodeToScoreboardCreated(out.notices[0]);
        // console.log(dec)
    } catch (e) {
        if (typeof e == "string" && e.startsWith("0x"))
            decodeToConventionalTypes(e,"str");
        else
            console.log(e)
    }
}

const getOutputsRun = async () => {
    const d1 = await getOutputs({}); //{tags:["create_scoreboard"]});
    console.log("ouputs");
    console.log(d1)
}

const cartridgeRun = async () => {
    const d = await cartridge({id:cartridge_id},{decode:true,decodeModel:"bytes"});
    console.log("Cartridge");
    console.log(d);
    // const c = decodeToConventionalTypes(d.payload,"bytes");
    // console.log(c)
}


// cartridgesRun();
// cartridgeInfoRun();
// createScoreboardRun();
// getOutputsRun();
// cartridgeRun();
