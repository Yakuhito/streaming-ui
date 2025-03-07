'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Toaster, toast } from 'react-hot-toast';
import { WalletConnect } from '../lib/WalletConnect';
import Modal from './Modal';
import { useAppSelector } from '../redux/hooks';

// Create a singleton instance of WalletConnect
const walletConnect = new WalletConnect();

export default function WalletConnector() {
  const { address, isInitialized, qrUri } = useAppSelector(state => state.wallet);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    walletConnect.waitForInit();
  }, []);

  const handleConnect = async () => {
    console.log('Connect button clicked, setting modal to open');
    setIsModalOpen(true);
    console.log('Modal state after setting:', isModalOpen);  // Note: This will show the previous state due to React's state updates
    try {
      const success = await walletConnect.connectWallet();
      console.log('Wallet connection result:', success);
      // Only close the modal if connection was successful
      if (success) {
        setIsModalOpen(false);
      }
    } catch (error) {
      // Keep modal open if there's an error
      console.error("Wallet connection failed:", error);
    }
  };

  const handleCopyLink = async () => {
    if (!qrUri) return;
    
    try {
      await navigator.clipboard.writeText(qrUri);
      setIsCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 1000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  if (!isInitialized || !address) {
    return (
      <>
        <button
          onClick={handleConnect}
          className="px-4 py-2 font-normal text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          Connect Wallet
        </button>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Connect Sage Wallet"
        >
          <div className="flex flex-col items-center gap-4">
            {qrUri ? (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG value={qrUri} size={256} />
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 text-sm font-medium focus:outline-none flex items-center gap-2 ${
                    isCopied 
                      ? 'text-green-600 hover:text-green-500' 
                      : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isCopied ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    )}
                  </svg>
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </button>
                <p className="text-sm text-center text-gray-600 mt-2">
                  Scan the code or copy the link and paste it in your wallet
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            )}
          </div>
        </Modal>

        <Toaster 
          position="bottom-right"
          toastOptions={{
            duration: 2000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          Address: {address.slice(0, 7)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => walletConnect.disconnectWallet()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Disconnect wallet"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </>
  );
} 