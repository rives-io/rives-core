"use client"




import { useContext, useEffect } from "react";
import { gameplayContext } from "../play/GameplayContextProvider";
import { useConnectWallet } from "@web3-onboard/react";


function GameplaySubmitter() {
    const {gameplay, setGameplayLog} = useContext(gameplayContext);
    const [{ wallet }, connect] = useConnectWallet();

    useEffect(() => {
        if (!gameplay) return;

        submitLog();
    }, [gameplay])

    async function submitLog() {
        if (!gameplay){
            alert("No gameplay data.");
            return;
        }

        if (!wallet) {
            await alert("Connect first to upload a gameplay log.");
            await connect();
        }

        // TO DO:
        // submit the gameplay
        console.log(gameplay);

    }

    // TO DO:
    // submit the gameplay Modal
    return (
        <></>
    );
}

export default GameplaySubmitter;