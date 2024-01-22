import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/app/components/Navbar';
import {Web3OnboardProviderClient} from './utils/web3OnboardProvider';
import { fontPressStart2P } from './utils/font';

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
      <Web3OnboardProviderClient>
        <body className={fontPressStart2P.className}>
          <Navbar></Navbar>
          {children}
        </body>
      </Web3OnboardProviderClient>
    </html>
  )
}
