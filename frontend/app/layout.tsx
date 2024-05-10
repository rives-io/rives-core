import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/app/components/Navbar';
//import {Web3OnboardProviderClient} from './utils/web3OnboardProvider';
import { fontPressStart2P } from './utils/font';
import Footer from './components/Footer';
import PrivyProviders from "./utils/privyProvider";

export const metadata: Metadata = {
  title: 'RiVES',
  description: 'RiscV Verifiable Entertainment System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en-US">
        <body className={fontPressStart2P.className}>
          <PrivyProviders>
            <Navbar></Navbar>
            {children}
            <Footer></Footer>
          </PrivyProviders>
        </body>
    </html>
  )
}
