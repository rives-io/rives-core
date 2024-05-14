'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from 'react'
import RivesLogo from './svg/RivesLogo';
import MenuIcon from '@mui/icons-material/Menu';
import { Menu } from '@headlessui/react'
import { usePrivy } from '@privy-io/react-auth';
// import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function Navbar() {
    const pathname = usePathname();
    const [connectButtonTxt, setConnectButtonTxt] = useState<React.JSX.Element>(<span>Connect</span>);
    
    const {ready, authenticated, login, logout, user, linkDiscord} = usePrivy();
    // Disable login when Privy is not ready or the user is already authenticated
    const disableLogin = !ready || (ready && authenticated);

    useEffect(() => {
        if (!user) {
            setConnectButtonTxt(<span>Connect</span>);
            return;
        }

        if ((ready && authenticated) && !user.discord) {
            linkDiscord();
        }

        if (user.discord) {
            const userAddress = user.wallet?.address;
            setConnectButtonTxt(
                <>
                    <span className='text-[10px] opacity-50'>
                        {user.discord.username}
                    </span>
                    <span>Disconnect</span>
                    {
                        userAddress?
                            <span className='text-[10px] opacity-50'>
                                {userAddress.slice(0, 6)}...{userAddress.slice(userAddress.length-4)}
                                {/* <button className='border border-transparent hover:border-white ms-1'
                                onMouseOver={(e) => {e.preventDefault()}}
                                onClick={(e) => {e.stopPropagation(); copyToClipboard(userAddress);}}>
                                    <ContentCopyIcon />
                                </button> */}
                            </span>
                        :
                            <></>
                    }
                </>
                
            );
        }
        // else if (user.linkedAccounts.length > 0 && user.linkedAccounts[0].type == 'wallet') {
        //     const userAddress = user.linkedAccounts[0].address;
        //     setConnectButtonTxt(
        //         <>
        //             <span>Disconnect</span>
        //             <span className='text-[10px] opacity-50'>
        //                 {userAddress.slice(0, 6)}...{userAddress.slice(userAddress.length-4)}
        //             </span>
        //         </> 
        //     );

        // }

    }, [user])

    // function copyToClipboard(s:string) {
    //     navigator.clipboard.writeText(s);
    //     alert(`${s} copied to clipboard!`);
    // }

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
                <button className='navbar-item'
                    disabled={!ready}
                    onClick={disableLogin?logout:login}
                    title={user?.wallet?.address}
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
                                    disabled={!ready}
                                    onClick={disableLogin?logout:login}
                                    title={user?.wallet?.address}
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