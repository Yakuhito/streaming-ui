'use client';

import { useEffect } from 'react';
import { walletConnect } from '../lib/walletConnectInstance';

export default function WalletInitializer() {
  useEffect(() => {
    // Initialize WalletConnect as soon as possible
    walletConnect.waitForInit().then(() => {
      console.log("WalletConnect initialization completed");
    }).catch((error) => {
      console.error("WalletConnect initialization failed:", error);
    });
  }, []);

  // This component doesn't render anything
  return null;
} 