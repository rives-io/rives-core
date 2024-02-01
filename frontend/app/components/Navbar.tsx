'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from 'react'
import ThemeSwitch from "@/app/components/ThemeSwitch";
import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import rivesLogo from '../../public/rives_logo.png';
import Image from 'next/image'

function Navbar() {
    const pathname = usePathname();
    const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
    const [{ chains, connectedChain }, setChain] = useSetChain();
    const [connectButtonTxt, setConnectButtonTxt] = useState("Connect");

    useEffect(() => {
        if (!connectedChain) return;

        chains.forEach((chain) => {
            if (connectedChain.id == chain.id) return;
        })

        setChain({chainId: chains[0].id});

      }, [connectedChain])


    useEffect(() => {
        if (connecting) {
            setConnectButtonTxt('Connecting');
        } else if (wallet) {
            setConnectButtonTxt('Disconnect');
        } else {
            setConnectButtonTxt('Connect');
        }
    }, [connecting, wallet])

    return (
        <header className='header'>
            {/* <Link href={"/"} className={`font-semibold title-color ${fontPressStart2P.className}`}>
                <span>RiVES</span>
            </Link> */}

            <Link href={"/"}>
                <Image src={rivesLogo} alt='RiVES' width={96} ></Image>
            </Link>

            <nav className='flex gap-7 font-medium'>
                <a href={"/cartridges"} className={ pathname === "/cartridges" ? "link-active" : "link-2step-hover" }>
                    <p>Cartridges</p>
                </a>

                <Link href={"/insert-cartridge"} className={ pathname === "/insert-cartridge" ? "link-active" : "link-2step-hover" }>
                    <p>Insert Cartridge</p>
                </Link>
            </nav>

            <div className='flex space-x-6'>
                <ThemeSwitch/>

                <button className='web3-connect-btn' disabled={connecting}
                    onClick={() => (wallet ? disconnect(wallet) : connect())}
                >
                    {connectButtonTxt}
                </button>

            </div>
        </header>
    )
}

export default Navbar