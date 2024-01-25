import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/app/components/Navbar';
import {Web3OnboardProviderClient} from './utils/web3OnboardProvider';
import { getCookieTheme } from './utils/theme';

export const metadata: Metadata = {
  title: 'RiVES',
  description: 'RiscV Verifiable Entertainment System',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  let theme = (await getCookieTheme()) || "light";

  return (
    <html lang="en-US" data-theme={theme}>
      <Web3OnboardProviderClient>
        <body>
          <Navbar></Navbar>
          {children}
        </body>
      </Web3OnboardProviderClient>
    </html>
  )
}
