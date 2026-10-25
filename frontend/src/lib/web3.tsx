"use client";

import React, { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  polygonAmoy,
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

const config = createConfig({
  chains: [polygonAmoy],
  connectors: [
    injected(),
  ],
  transports: {
    [polygonAmoy.id]: http(),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Contract Constants
export const NEXTWIN_ACCESS_ADDRESS = '0x8b5cf68b5cf68b5cf68b5cf68b5cf68b5cf68b5c'; // Placeholder
export { default as NexTwinABI } from './abi/NexTwinAccess.json';
export const MEDGENIE_ACCESS_ADDRESS = NEXTWIN_ACCESS_ADDRESS;
export { default as MedGenieABI } from './abi/NexTwinAccess.json';
