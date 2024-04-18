"use client"


import { useEffect, useState } from "react";
import { VerificationOutput } from "../backend-libs/core/ifaces";
import { getOutputs } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import { getTapesGifs } from "../utils/util";
import Image from "next/image";

async function getTapes() {
  const verificationOutputs:Array<VerificationOutput> = await getOutputs(
    {
        tags: ["score"]
    },
    {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
  );
  if (verificationOutputs.length === 0) throw new Error(`No Tapes found!`);

  return verificationOutputs;
}

export default function Tapes() {
  const [verificationOutputs, setVerificationOutputs] = useState<Array<VerificationOutput>|null>(null);
  const [gifs, setGifs] = useState<Array<string>|null>(null);

  useEffect(() => {
    getTapes().then((result) => {
      setVerificationOutputs(result)
      const tapes = result.map((verificationOutput) => verificationOutput.tape_hash.slice(2));
      console.log(tapes)
      getTapesGifs(tapes).then(setGifs);
    });
  }, [])


  if (!verificationOutputs || !gifs) {
    return "Fetching Tapes";
  }

  if (verificationOutputs.length == 0) {
    return "No Tapes Found";
  }


  return (
    <main className="flex justify-center h-lvh">
      <section className="py-16 my-8 w-full flex justify-center">
        <div className="grid grid-cols-4 space-x-4">
          {
            verificationOutputs.map((verificationOutput, index) => {
              return <Image key={index} className="border border-black" width={200} height={200} src={"data:image/gif;base64,"+gifs[index]} alt={"Not found"}/>
            })
          }
        </div>
      </section>
    </main>
  )
}
