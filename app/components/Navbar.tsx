'use client';

import Link from 'next/link';
import WalletConnector from './WalletConnector';
// Remove the WalletConnect instance creation
// const walletConnect = new WalletConnect();

export default function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Brand name */}
                    <div className="flex-shrink-0">
                        <Link href="/" className="text-xl font-bold text-gray-800">
                            Streaming Dashboard
                        </Link>
                    </div>

                    <WalletConnector />
                </div>
            </div>
        </nav>
    );
} 