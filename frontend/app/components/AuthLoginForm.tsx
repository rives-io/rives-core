"use client"

import { useConnectWallet } from "@web3-onboard/react";
import { useEffect } from "react";

function AuthLoginForm({session, loginFunction}:{session:any, loginFunction(code:string, userAddress:string):void}) {
    const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();

    useEffect(() => {
        if (!wallet) return;

        const userAddress = wallet.accounts[0].address;
        const login = async () => {
            try {
                await loginFunction(session.code, userAddress);    
            } catch (error) {
                alert((error as Error).message);
                disconnect(wallet);
            }
        }

        login();

    }, [wallet])


    return (
        <div className="flex flex-col">
            <h3 className="text-white mb-4">Connect to complete your login</h3>
            
            <button className="btn w-fit self-center" disabled={connecting} onClick={() => connect()}>
                Connect
            </button>
        </div>
    )
}

export default AuthLoginForm