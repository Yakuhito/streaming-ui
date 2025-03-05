'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Toaster, toast } from 'react-hot-toast';
import { WalletConnect } from '../lib/WalletConnect';
import Modal from './Modal';

// Create a singleton instance of WalletConnect
const walletConnect = new WalletConnect();

export default function WalletConnector() {
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check if we're already connected
    setIsConnected(walletConnect.isConnected());
    setAddress(walletConnect.getActiveAddress());
  }, []);

  const handleCopyLink = async () => {
    if (!qrUri) return;
    
    try {
      await navigator.clipboard.writeText(qrUri);
      toast.success('Link copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleConnect = async () => {
    if (isConnected) {
      await walletConnect.disconnect();
      setIsConnected(false);
      setAddress(undefined);
      setQrUri(null);
      return;
    }

    setIsModalOpen(true);
    await walletConnect.connect();
  };

  useEffect(() => {
    // Patch the connect method to capture the QR URI
    const originalConnect = walletConnect.connect;
    walletConnect.connect = async () => {
      try {
        const client = await walletConnect['initClient']();
        if (!client) return false;

        const { uri, approval } = await client.connect({
          requiredNamespaces: {
            chia: {
              methods: ['chia_getAddress'],
              chains: ["chia:mainnet"],
              events: [],
            },
          },
        });

        if (uri) {
          setQrUri(uri);
        }

        const session = await approval();
        walletConnect['session'] = session;
        walletConnect['topic'] = session.topic;
        
        const address = await walletConnect.getAddress();
        setAddress(address);
        setIsConnected(true);
        setQrUri(null);
        setIsModalOpen(false);
        
        return true;
      } catch (error: any) {
        console.error(error);
        setIsModalOpen(false);
        return false;
      }
    };

    return () => {
      walletConnect.connect = originalConnect;
    };
  }, []);

  return (
    <>
      <button
        onClick={handleConnect}
        className="px-4 py-2 font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
      >
        {isConnected ? (
          <span className="flex items-center gap-2">
            <span>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}</span>
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setQrUri(null);
        }}
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
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Link
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

      <Toaster position="top-right" />
    </>
  );
} 