'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from 'react'
import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import RivesLogo from './svg/RivesLogo';
import MenuIcon from '@mui/icons-material/Menu';
import { Menu } from '@headlessui/react'

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
            <Link href={"/"} className={`min-w-24 grid grid-cols-1 items-center navbar-item ${pathname === "/" ? "lg:link-active" : "" }`}>
                <RivesLogo className="w-full min-w-16 max-w-28" />
            </Link>

            <Link href={"/cartridges"} className={`invisible lg:visible h-full grid grid-cols-1 items-center navbar-item ${pathname.startsWith("/cartridges") ? "lg:link-active" : "" }`}>
                <p>Cartridges</p>
            </Link>

            <Link href={"/contests"} className={`invisible lg:visible h-full grid grid-cols-1 items-center navbar-item ${pathname.startsWith("/contests") ? "lg:link-active" : "" }`}>
                Contests
            </Link>

            <Link href={"/tapes"} className={`invisible lg:visible h-full grid grid-cols-1 items-center navbar-item ${pathname.startsWith("/tapes") ? "lg:link-active" : "" }`}>
                Tapes
            </Link>

            <div className='invisible lg:visible flex-1 flex justify-end h-full'>
                <button className='navbar-item' disabled={connecting}
                    onClick={() => (wallet ? disconnect(wallet) : connect())}
                    title={wallet? wallet.accounts[0].address:""}
                >
                    <div className='flex flex-col justify-center h-full'>
                        {connectButtonTxt}
                    </div>
                </button>
            </div>

            <Menu as="div" className="lg:hidden navbar-item">
                <Menu.Button className="h-full flex flex-col justify-center"><MenuIcon className='text-5xl' /></Menu.Button>
                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                    <div className="px-1 py-1 ">
                        <Menu.Item>
                            {({ active }) => (
                                <Link 
                                href={"/cartridges"} 
                                className={`${pathname === "/cartridges" || active? 'bg-rives-purple text-white' : 'text-black' 
                                } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                    Cartridges
                                </Link>
                            )}
                        </Menu.Item>
                    </div>

                    <div className="px-1 py-1 ">
                        <Menu.Item>
                            {({ active }) => (
                                <Link 
                                href={"/contests"} 
                                className={`${pathname === "/contests" || active ? 'bg-rives-purple text-white' : 'text-black'
                                } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                    Contests
                                </Link>
                            )}
                        </Menu.Item>
                    </div>

                    <div className="px-1 py-1">
                        <Menu.Item>
                            {({ active }) => (
                                <Link 
                                href={"/tapes"} 
                                className={`${pathname === "/tapes" || active ? 'bg-rives-purple text-white' : 'text-black'
                                } group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                    Tapes
                                </Link>
                            )}
                        </Menu.Item>
                    </div>

                    <div className="px-1 py-1">
                        <Menu.Item>
                            {({ active }) => (
                                <div className='flex-1 flex justify-end h-full'>
                                    <button 
                                    className={`${active ? 'bg-rives-purple text-white' : 'text-black'
                                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`} 
                                    disabled={connecting}
                                    onClick={() => (wallet ? disconnect(wallet) : connect())}
                                    title={wallet? wallet.accounts[0].address:""}
                                    >
                                        <div className='flex flex-col justify-center h-full'>
                                            {connectButtonTxt}
                                        </div>
                                    </button>
                                </div>
                            )}
                        </Menu.Item>
                    </div>
                </Menu.Items>
            </Menu>
        </header>
    )
}

export default Navbar