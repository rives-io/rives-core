'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React from 'react'
import ThemeSwitch from "@/app/components/ThemeSwitch";
import { useConnectWallet } from '@web3-onboard/react';

function Navbar() {
    const pathname = usePathname();
    const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()

    return (
        <header className='header'>
            <Link href={"/"} className='font-semibold title-color'>
                <span>World</span>
                <br/>
                <span className='ps-2'>Arcade</span>
            </Link>

            <nav className='flex text-lg gap-7 font-medium'>
                <Link href={"/cartridges"} className={ pathname === "/cartridges" ? "link-active" : "link-2step-hover" }>
                    <p>Cartridges</p>
                </Link>

                <Link href={"/upload-cartridge"} className={ pathname === "/upload-cartridge" ? "link-active" : "link-2step-hover" }>
                    <p>Insert Cartridge</p>
                </Link>
            </nav>

            <div className='flex space-x-8'>
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