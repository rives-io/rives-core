'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation";
import React from 'react'
import RivesLogo from './svg/RivesLogo';
import {usePrivy} from '@privy-io/react-auth';

function Navbar() {
    const pathname = usePathname();
    // const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
    // const [{ chains, connectedChain }, setChain] = useSetChain();
    // const [connectButtonTxt, setConnectButtonTxt] = useState("Connect");
    const {ready, authenticated, login, logout} = usePrivy();
    // Disable login when Privy is not ready or the user is already authenticated
    const disableLogin = !ready || (ready && authenticated);
    const btnText = disableLogin?"Disconnect":"Connect";

    // useEffect(() => {
    //     if (!connectedChain) return;

    //     chains.forEach((chain) => {
    //         if (connectedChain.id == chain.id) return;
    //     })

    //     setChain({chainId: chains[0].id});

    //   }, [connectedChain])


    // useEffect(() => {
    //     if (connecting) {
    //         setConnectButtonTxt('Connecting');
    //     } else if (wallet) {
    //         setConnectButtonTxt('Disconnect');
    //     } else {
    //         setConnectButtonTxt('Connect');
    //     }
    // }, [connecting, wallet])

    return (
        <header className='header'>
            <Link href={"/"} className={`h-full grid grid-cols-1 items-center navbar-item ${pathname === "/" ? "link-active" : "" }`}>
                <RivesLogo style={{width:100}}/>
            </Link>

            <a href={"/cartridges"} className={`invisible md:visible h-full grid grid-cols-1 items-center navbar-item ${pathname === "/cartridges" ? "link-active" : "" }`}>
                <p>Cartridges</p>
            </a>

            <Link href={"/insert-cartridge"} className={`invisible md:visible h-full grid grid-cols-1 items-center navbar-item ${pathname === "/insert-cartridge" ? "link-active" : "" }`}>
                Insert Cartridge
            </Link>

            <div className='flex-1 flex justify-end'>
                <button className='navbar-item' onClick={disableLogin?logout:login}>
                    {btnText}
                </button>
            </div>
        </header>
    )
}

export default Navbar