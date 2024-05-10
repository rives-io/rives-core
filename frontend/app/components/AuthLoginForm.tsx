"use client"

import { usePrivy } from '@privy-io/react-auth';
import { useEffect } from "react";

function AuthLoginForm({session, loginFunction}:{session:any, loginFunction(code:string, userAddress:string):void}) {
    const {user, ready, login, logout} = usePrivy();

    useEffect(() => {
        if (!user || !user.wallet) return;

        const userAddress = user.wallet.address;
        const login = async () => {
            try {
                await loginFunction(session.code, userAddress);    
            } catch (error) {
                alert((error as Error).message);
                logout();
            }
        }

        login();

    }, [user])


    return (
        <div className="flex flex-col">
            <h3 className="text-white mb-4">Connect to complete your login</h3>
            
            <button className="btn w-fit self-center" disabled={!ready} onClick={() => login()}>
                Connect
            </button>
        </div>
    )
}

export default AuthLoginForm