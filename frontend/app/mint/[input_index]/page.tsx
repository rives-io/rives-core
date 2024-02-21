"use client"
import { useSearchParams } from 'next/navigation'
import {  useState, useEffect, useMemo } from 'react'
import Image from 'next/image';
import { Contract, ethers } from 'ethers';
import { useConnectWallet } from "@web3-onboard/react";


import { ReplayScore, getOutputs } from "../../backend-libs/app/lib";
import { envClient } from '../../utils/clientEnv';
import { fontPressStart2P } from "../../utils/font"
import nftAbiFile from "../../contracts/RivesScoreNFT.sol/RivesScoreNFT.json"
import { delay } from "../../utils/util";
import CheckIcon from "../../components/svg/CheckIcon";
import ErrorIcon from "../../components/svg/ErrorIcon";
import CloseIcon from "@mui/icons-material/Close";

const nftAbi: any = nftAbiFile;

const BASE64_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function byteToBase64(bytes: Uint8Array): String {
    let newBase64 = '';
    let currentChar = 0;
    for (let i=0; i<bytes.length; i++) {   // Go over three 8-bit bytes to encode four base64 6-bit chars
        if (i%3===0) { // First Byte
            currentChar = (bytes[i] >> 2);      // First 6-bits for first base64 char
            newBase64 += BASE64_KEY[currentChar];      // Add the first base64 char to the string
            currentChar = (bytes[i] << 4) & 63; // Erase first 6-bits, add first 2 bits for second base64 char
        }
        if (i%3===1) { // Second Byte
            currentChar += (bytes[i] >> 4);     // Concat first 4-bits from second byte for second base64 char
            newBase64 += BASE64_KEY[currentChar];      // Add the second base64 char to the string
            currentChar = (bytes[i] << 2) & 63; // Add two zeros, add 4-bits from second half of second byte
        }
        if (i%3===2) { // Third Byte
            currentChar += (bytes[i] >> 6);     // Concat first 2-bits of third byte for the third base64 char
            newBase64 += BASE64_KEY[currentChar];      // Add the third base64 char to the string
            currentChar = bytes[i] & 63;        // Add last 6-bits from third byte for the fourth base64 char
            newBase64 += BASE64_KEY[currentChar];      // Add the fourth base64 char to the string
        }
    }
    if (bytes.length%3===1) { // Pad for two missing bytes
        newBase64 += `${BASE64_KEY[currentChar]}==`;
    }
    if (bytes.length%3===2) { // Pad one missing byte
        newBase64 += `${BASE64_KEY[currentChar]}=`;
    }
    return newBase64;
}

enum STATUS {
  READY,
  VALID,
  INVALID,
}

interface FEEDBACK_STATUS {
  status:STATUS,
  message?:string
}

const Feedback = ({feedback,setFeedback}:{feedback:FEEDBACK_STATUS, setFeedback(s:FEEDBACK_STATUS):void}) => {
  if (feedback.status === STATUS.VALID) {
      delay(2500).then(() =>{
        setFeedback({status: STATUS.READY} as FEEDBACK_STATUS);
      })
      return (
          <div className="fixed flex items-center max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow-lg right-5 bottom-20 dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800" role="alert">
              <CheckIcon/>
              <div className="ms-3 text-sm font-bold">{feedback.message}</div>
          </div>
      )
  } else if (feedback.status === STATUS.INVALID) {
      const click = () => {
        setFeedback({status: STATUS.READY} as FEEDBACK_STATUS)
      }
      return (
          <div className="fixed flex-col items-center max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow right-5 bottom-[20%] dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800" role="alert">
              <div className="flex items-center pb-1 border-b">
                  <ErrorIcon/>
                  <div className="ms-3 text-sm font-normal">Invalid</div>
                  <button onClick={click} type="button" className="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" data-dismiss-target="#toast-danger" aria-label="Close">
                      <span className="sr-only">Close</span>
                      <CloseIcon/>
                  </button>
              </div>
              <div>
                  {feedback.message}
              </div>
          </div>
      )
  }
}

export default function Page({ params }: { params: { input_index: String } }) {
  // const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputIndex = useMemo(() => parseInt(`${params.input_index}`),[]);

  let signature: String | null = null;

  if (searchParams.has("signature") && searchParams.get("signature") != null)
    signature = searchParams.get("signature");

  if (inputIndex == undefined)
    return (
      <main className="flex items-center justify-center h-lvh">
        <span className={`${fontPressStart2P.className} text-4xl` }>Nothing to show here!</span>
        <span>No input index defined</span>
      </main>
    )

  return (
    <main className="flex items-center justify-center h-lvh">
      <Info inputIndex={inputIndex} signature={signature} />
    </main>
  )

}

const Info = ({inputIndex,signature}:{inputIndex: number,signature:String|null}) => {
  const [{ wallet }] = useConnectWallet();
  const [score,setScore] = useState<ReplayScore>();


  const [nftContract,setNftContract] = useState<Contract>();
  const [gamelogOwner,setGamelogOwner] = useState<String>();
  const [operator,setOperator] = useState<String>();
  const [signerAddress,setSignerAddress] = useState<String>();
  const [alreadyMinted,setAlreadyMinted] = useState<boolean>(false);
  const [feedback, setFeedback] = useState({status: STATUS.READY} as FEEDBACK_STATUS);
  // const score: ReplayScore | undefined = await useMemo( async () => {
  //   const out = await getOutputs({tags: ["screenshot"],input_index: inputIndex}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL})
  //   if (out.length == 0) return undefined;
  //   return out[0] as ReplayScore;
  // }, []);

  useEffect(() => {
    if (!wallet) {
      setNftContract(undefined);
      return;
    }
    const curSigner = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
    const curContract = new ethers.Contract(envClient.NFT_ADDR,nftAbi.abi,curSigner);
    curContract.provider.getCode(curContract.address).then((code) => {
      if (code == '0x') {
          console.log("Couldn't get nft contract")
          return;
      }
      setNftContract(curContract);
      curSigner.getAddress().then((a: String) => setSignerAddress(a.toLowerCase()));
      curContract.operator().then((o: String) => setOperator(o.toLowerCase()));
      if (score != undefined && score.gameplay_hash != undefined) {
        curContract.gamelogOwner(score.gameplay_hash).then((o: String) => setGamelogOwner(o.toLowerCase()));
        if (score._proof != undefined)
          curContract.ckeckMinted(score._payload,score._proof).then((o: boolean) => {console.log("minted",o);setAlreadyMinted(o)});
      }
    });
  },[wallet,score]);

  useEffect(() => getScore(),[]);

  const getScore = () => {
    getOutputs({tags: ["score"],input_index: inputIndex}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL})
      .then((out) =>{
        if (out.length == 0) return;
        const curScore = out[0] as ReplayScore;
        setScore(curScore);
    });
  };


  const feedbackAndReload = (message: string) => {
    setFeedback({status:STATUS.VALID,message:message});
    getScore();
  };

  if (score == undefined)
    return (
      <div className="flex flex-col items-center text-white">
        <span className={`${fontPressStart2P.className} text-1xl` }>Gameplay not processed by the Cartesi Machine Backend (yet)!</span>
        <button className="btn mt-5 w-48" onClick={() => {getScore()}}>
          Reload Score
        </button>
      </div>
    );

  return (
      <div className="flex flex-col">
        <Screenshot inputIndex={inputIndex} />
        <NftButtons signature={signature} score={score} nftContract={nftContract}
          gamelogOwner={gamelogOwner} operator={operator} signerAddress={signerAddress}
          alreadyMinted={alreadyMinted} reload={feedbackAndReload} />
          <Feedback feedback={feedback} setFeedback={setFeedback} />

      </div>
  );
};


const NftButtons = ({signature,score,nftContract,gamelogOwner,operator,signerAddress,alreadyMinted,reload}:
  {signature:String|null,score:ReplayScore,nftContract:Contract|undefined,gamelogOwner:String|undefined,
    operator:String|undefined,signerAddress:String|undefined,alreadyMinted:boolean|undefined,reload(s:String):void}) => {

  const userAddress = score.user_address?.toLowerCase();

  const mint = async () => {
    if (score?._proof == undefined) {
      alert("No proofs yet.");
      return;
    }
    if (!nftContract) {
      alert("Contract not loaded.");
      return;
    }
    if (alreadyMinted) {
      alert("Already Minted.");
      return;
    }
    if (operator == userAddress && (!gamelogOwner || gamelogOwner == '0x0000000000000000000000000000000000000000')) {
      alert("Operator generated (register first).");
      return;
    }
    nftContract.mint(score._payload,score._proof).
      then((res: any) => {
        res.wait(1).then(
          (receipt: any) => {
            console.log(receipt)
            reload("Nft Minted!");
          }
        );
      }
    );
  };

  const register = async () => {
    if (!signature || signature.length != 132) {
      alert("Invalid signature.");
      return;
    }
    if (!nftContract) {
      alert("Contract not loaded.");
      return;
    }
    if (alreadyMinted) {
      alert("Already Minted.");
      return;
    }
    if (signerAddress == operator){
      alert("Operator can't register.");
      return;
    }
    if (gamelogOwner != '0x0000000000000000000000000000000000000000') {
      alert("Already registered.");
      return;
    }
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    nftContract.setGameplayOwner(score.gameplay_hash,r,s,v).
      then((res: any) => {
        res.wait(1).then(
          (receipt: any) => {
            console.log(receipt)
            reload("Gameplay Registered");
          }
        );
      }
    );
  };

  let mintEnabled = false;
  let mintMessage = <></>;
  if (score?._proof == undefined)
    mintMessage = <span>(check again later, no proofs yet)</span>;
  else if (!nftContract)
    mintMessage = <span>(connect wallet)</span>;
  else if (alreadyMinted)
    mintMessage = <span>(already Minted)</span>;
  else if (operator == userAddress && (!gamelogOwner || gamelogOwner == '0x0000000000000000000000000000000000000000'))
    mintMessage = <span>(operator generated, register first)</span>;
  else {
    mintEnabled = true;
    mintMessage = <span></span>;
  }

  const mintButton =
    <button className="btn" onClick={() => {mint()}} disabled={!mintEnabled}>
      <span>Mint Score Screenshot NFT</span><br/>
      {mintMessage}
    </button>
  ;

  let showRegister = false;
  let registerEnabled = false;
  let registerMessage = <></>;
  if (!nftContract)
    registerMessage = <span>(connect wallet)</span>;
  else if (alreadyMinted)
    mintMessage = <span>(already Minted)</span>;
  else if (operator == userAddress) {
    showRegister = true;
    if (signerAddress == operator)
      registerMessage = <span>(operator can't register)</span>;
    else if (gamelogOwner != '0x0000000000000000000000000000000000000000')
      registerMessage = <span>(already registered)</span>;
    else if (!signature)
      registerMessage = <span>(no signature)</span>;
    else {
      registerEnabled = true
      registerMessage = <span></span>;
    }
  }

  const registerButton = !showRegister ?
    <></>
    :
    <button className="btn" onClick={() => {register()}} disabled={!registerEnabled}>
      <span>Register Gameplay</span><br/>
      {registerMessage}
    </button>
  ;

  return (
    <div className='flex flex-col space-y-1 mt-1 text-sm'>
      {mintButton}
      {registerButton}
    </div>
);
}
const Screenshot = ({inputIndex}:{inputIndex: number}) => {
  const [base64Image,setBase64Image] = useState<String>();
  useEffect(() => {
    if (inputIndex == undefined) return;
    getOutputs({tags: ["screenshot"],input_index: inputIndex}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL})
      .then((out) => {
        if (out.length == 0) return;
        setBase64Image(byteToBase64(out[0] as Uint8Array))
    });
  },[inputIndex]);

  if (!base64Image) return (
  <div>
    <span className={`${fontPressStart2P.className} text-1m` }>Nothing to show here!</span>
  </div>
  );

  return (
      <Image alt={"screenshot " + inputIndex}
      height={512} width={1200}
      id={"screenshot-" + inputIndex}
      src={base64Image ? `data:image/png;base64,${base64Image}`:"/logo.png"}
      style={{
          maxHeight: 512,
          height: '100%',
          width: 'auto'
      }}
      />
  );
};
