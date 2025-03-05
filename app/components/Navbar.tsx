'use client';

import Link from 'next/link';

export default function Navbar() {
    return (
        <nav className="w-full bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center">
                    {/* Brand name */}
                    <div className="flex-shrink-0">
                        <Link href="/" className="text-xl font-bold text-gray-800">
                            Streaming Dashboard
                        </Link>
                    </div>

                    {/* Action Buttons */}
                    <div className="ml-auto flex items-center space-x-4">
                        <button 
                            className="text-gray-600 hover:text-gray-900 px-4 py-2 text-sm font-medium"
                            onClick={() => {/* TODO: Implement create modal */}}
                        >
                            Create Stream
                        </button>
                        <button 
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                            onClick={() => {/* TODO: Implement wallet connection */}}
                        >
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
} 