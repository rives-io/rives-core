'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from 'react'
import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import RivesLogo from './svg/RivesLogo';

function Navbar() {
    const pathname = usePathname();
    const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
    const [{ chains, connectedChain }, setChain] = useSetChain();
    const [connectButtonTxt, setConnectButtonTxt] = useState<React.JSX.Element>(<span>Connect</span>);

    useEffect(() => {
        if (!connectedChain) return;

        chains.forEach((chain) => {
            if (connectedChain.id == chain.id) return;
        })

        setChain({chainId: chains[0].id});

      }, [connectedChain])


    useEffect(() => {
        if (connecting) {
            setConnectButtonTxt(<span>Connecting</span>);
        } else if (wallet) {
            const currAddress = wallet.accounts[0].address;

            setConnectButtonTxt(
                <>
                    <span>Disconnect</span>
                    <span className='text-[10px] opacity-50'>
                        {currAddress.slice(0, 6)}...{currAddress.slice(currAddress.length-4)}
                    </span>
                </>
                
            );
        } else {
            setConnectButtonTxt(<span>Connect</span>);
        }
    }, [connecting, wallet])

    return (
        <header className='header'>
            <Link href={"/"} className={`h-full grid grid-cols-1 items-center navbar-item ${pathname === "/" ? "link-active" : "" }`}>
                <RivesLogo style={{width:100}}/>
            </Link>

            <a href={"/cartridges"} className={`invisible md:visible h-full grid grid-cols-1 items-center navbar-item ${pathname === "/cartridges" ? "link-active" : "" }`}>
                <p>Cartridges</p>
            </a>

            <Link href={"/contests"} className={`invisible md:visible h-full grid grid-cols-1 items-center navbar-item ${pathname === "/contests" ? "link-active" : "" }`}>
                Contests
            </Link>

            <Link href={"/tapes"} className={`invisible md:visible h-full grid grid-cols-1 items-center navbar-item ${pathname === "/tapes" ? "link-active" : "" }`}>
                Tapes
            </Link>

            <Link href={"/upload-cartridge"} className={`invisible md:visible h-full grid grid-cols-1 items-center navbar-item ${pathname === "/upload-cartridge" ? "link-active" : "" }`}>
                Upload Cartridge
            </Link>

            <div className='flex-1 flex justify-end h-full'>
                <button className='navbar-item' disabled={connecting}
                    onClick={() => (wallet ? disconnect(wallet) : connect())}
                    title={wallet? wallet.accounts[0].address:""}
                >
                    <div className='flex flex-col justify-center h-full'>
                        {connectButtonTxt}
                    </div>
                </button>
            </div>
        </header>
    )
}

export default Navbar