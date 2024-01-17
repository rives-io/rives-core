"use client"


import { Web3OnboardProvider } from '@web3-onboard/react'
import web3Onboard from './web3-onboard';


export function Web3OnboardProviderClient({ children }:{ children: React.ReactNode }) {
    return (
        <Web3OnboardProvider web3Onboard={web3Onboard}>
            { children }
        </Web3OnboardProvider>
    );
}