'use client';

import {PrivyProvider} from '@privy-io/react-auth';
import { getChain } from './util';
import { envClient } from './clientEnv';

export default function PrivyProviders({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId="clu7afadg02xd7ei97jlmd3vj"
      config={{
        // Customize Privy's appearance in your app
        appearance: {
          theme: 'light',
          accentColor: '#676FFF'
        },
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: getChain(envClient.NETWORK_CHAIN_ID)
      }}
    >
      {children}
    </PrivyProvider>
  );
}