"use client"
import { usePathname, useSearchParams } from 'next/navigation'
import {  useState, useEffect, useMemo } from 'react'
import Image from 'next/image';
import { Contract, ethers } from 'ethers';
import { useConnectWallet } from "@web3-onboard/react";
import type { WalletState } from '@web3-onboard/core';


import { ReplayScore, getOutputs } from "../../backend-libs/app/lib";
import { envClient } from '../../utils/clientEnv';
import { fontPressStart2P } from "../../utils/font"
import nftAbiFile from "../../contracts/RivesScoreNFT.sol/RivesScoreNFT.json"

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
    const curSigner = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner()
    const curContract = new ethers.Contract(envClient.NFT_ADDR,nftAbi.abi,curSigner)
    setNftContract(curContract);
    curSigner.getAddress().then((a: String) => setSignerAddress(a.toLowerCase()));
    curContract.operator().then((o: String) => setOperator(o.toLowerCase()));
    if (score != undefined && score.gameplay_hash != undefined) {
      curContract.gamelogOwner(score.gameplay_hash).then((o: String) => setGamelogOwner(o.toLowerCase()));
      if (score._proof != undefined)
        curContract.ckeckMinted(score._payload,score._proof).then((o: boolean) => {console.log("minted",o);setAlreadyMinted(o)});
    }
  },[wallet,score]);
  
  useEffect(() => {
    getOutputs({tags: ["score"],input_index: inputIndex}, {cartesiNodeUrl: envClient.CARTESI_NODE_URL})
      .then((out) =>{
        if (out.length == 0) return;
        const curScore = out[0] as ReplayScore;
        setScore(curScore);
    });
  },[]);
  
  if (score == undefined)
    return (
      <div className="flex flex-col">
        <span className={`${fontPressStart2P.className} text-1xl` }>Gameplay not processed by the Cartesi Machine Backend (yet)!</span>
      </div>
    );
  
  return (
      <div className="flex flex-col">
        <Screenshot inputIndex={inputIndex} />
        <NftButtons signature={signature} score={score} nftContract={nftContract} 
          gamelogOwner={gamelogOwner} operator={operator} signerAddress={signerAddress} 
          alreadyMinted={alreadyMinted}  />
      </div>
  );
};


const NftButtons = ({signature,score,nftContract,gamelogOwner,operator,signerAddress,alreadyMinted}:
  {signature:String|null,score:ReplayScore,nftContract:Contract|undefined,gamelogOwner:String|undefined,
    operator:String|undefined,signerAddress:String|undefined,alreadyMinted:boolean|undefined}) => {

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
    nftContract.mint(score._payload,score._proof).
      then((res: any) => {
        res.wait(1).then(
          (receipt: any) => {
            alert("Nft Minted!");
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
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    nftContract.setGameplayOwner(score.gameplay_hash,r,s,v).
      then((res: any) => {
        res.wait(1).then(
          (receipt: any) => {
            alert("Gameplay Registered");
          }
        );
      }
    );
  };

  let mintEnabled = false;
  let mintMessage = <></>;
  if (score?._proof == undefined)
    mintMessage = <span>No proofs yet<br/>(come back later)</span>;
  else if (!nftContract)
    mintMessage = <span>connect wallet</span>;
  else if (alreadyMinted) 
    mintMessage = <span>Already Minted</span>;
  else if (operator == userAddress && (!gamelogOwner || gamelogOwner == '0x0000000000000000000000000000000000000000'))
    mintMessage = <span>Operator generated (register first)</span>;
  else {
    mintEnabled = true;
    mintMessage = <span>Mint</span>;
  }
 
  const mintButton = 
    <button className={"button-57"} onClick={() => {mint()}} disabled={!mintEnabled}>
      <span>Mint Score Screenshot NFT</span>
      {mintMessage}
    </button>
  ;
  
  let showRegister = false;
  let registerEnabled = false;
  let registerMessage = <></>;
  if (!nftContract)
    registerMessage = <span>connect wallet</span>;
  else if (alreadyMinted) 
    mintMessage = <span>Already Minted</span>;
  else if (operator == userAddress) {
    showRegister = true;
    if (signerAddress == operator)
      registerMessage = <span>Operator can't register</span>;
    else if (gamelogOwner != '0x0000000000000000000000000000000000000000')
      registerMessage = <span>Already registered</span>;
    else if (!signature)
      registerMessage = <span>No signature</span>;
    else {
      registerEnabled = true
      registerMessage = <span>Register</span>;
    }
  }
 
  const registerButton = !showRegister ?
    <></>
    :
    <button className={"button-57"} onClick={() => {register()}} disabled={!registerEnabled}>
      <span>Register Gameplay</span>
      {registerMessage}
    </button>
  ;

  return (
    <>
      {mintButton}
      {registerButton}
    </>
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
      height={400} width={1200} 
      id={"screenshot-" + inputIndex}
      src={base64Image ? `data:image/png;base64,${base64Image}`:"/cartesi.jpg"}
      style={{
          maxHeight: 400,
          height: '100%',
          width: 'auto'
      }}
      />
  );
};
