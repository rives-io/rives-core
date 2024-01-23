'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React, { useState } from 'react'
import ThemeSwitch from "@/app/components/ThemeSwitch";
import rivesLogo from '../../public/rives_logo.png';
import Image from 'next/image'
import CloseIcon from './svg/CloseIcon';
import { fontPressStart2P } from '../utils/font';

function Navbar() {
    const pathname = usePathname();
    const [showModal, setShowModal] = useState(false);

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

                <Link href={"/insert-cartridge"} className={ pathname === "/insert-cartridge" ? "link-active" : "link-2step-hover" }>
                    <p>Insert Cartridge</p>
                </Link>
            </nav>

            <div className='flex space-x-6'>
                <ThemeSwitch/>

                <button className='web3-connect-btn' onClick={() => {setShowModal(true)}}>
                    Connect
                </button>

            </div>

            <div className={`${!showModal? "hidden":""} fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`}>
                <div className="relative p-4 w-full max-w-md max-h-full">
                    <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
                        <button onClick={() => setShowModal(false)} className="absolute top-3 end-2.5 text-gray-400 hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center">
                            <CloseIcon/>
                        </button>
                        <div className="p-4 md:p-5 text-center">
                            <svg className="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" strokeWidth="2" d="M10 11V6m0 8h.01M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                            </svg>
                            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                <span className={fontPressStart2P.className}>Under Maintenance!</span><br/>
                                Our current version is running in a local blockchain environment. We are working on a testnet deployment and will be back online soon.
                            </h3>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Navbar