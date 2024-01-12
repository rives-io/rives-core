'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React from 'react'
import ThemeSwitch from "@/app/components/ThemeSwitch";

function Navbar() {
    const pathname = usePathname();

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
                    <p>Upload Cartridge</p>
                </Link>
            </nav>
            <ThemeSwitch/>
        </header>
    )
}

export default Navbar