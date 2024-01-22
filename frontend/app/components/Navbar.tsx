'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React from 'react'
import ThemeSwitch from "@/app/components/ThemeSwitch";
import { useConnectWallet } from '@web3-onboard/react';
import rivesLogo from '../../public/rives_logo.png';
import Image from 'next/image'

function Navbar() {
    const pathname = usePathname();
    const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()

    return (
        <header className='header'>
            {/* <Link href={"/"} className={`font-semibold title-color ${fontPressStart2P.className}`}>
                <span>RiVES</span>
            </Link> */}

            <Link href={"/"}>
                <Image src={rivesLogo} alt='RiVES' width={96} ></Image>
            </Link>

            <nav className='flex gap-7 font-medium'>
                <Link href={"/cartridges"} className={ pathname === "/cartridges" ? "link-active" : "link-2step-hover" }>
                    <p>Cartridges</p>
                </Link>

                <Link href={"/upload-cartridge"} className={ pathname === "/upload-cartridge" ? "link-active" : "link-2step-hover" }>
                    <p>Insert Cartridge</p>
                </Link>
            </nav>

            <div className='flex space-x-6'>
                <ThemeSwitch/>

                <button className='web3-connect-btn' disabled={connecting}
                    onClick={() => (wallet ? disconnect(wallet) : connect())}
                >
                    {connecting ? 'Connecting' : wallet ? 'Disconnect' : 'Connect'}
                </button>

            </div>
        </header>
    )
}

export default Navbar