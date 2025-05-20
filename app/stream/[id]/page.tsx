'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function StreamPage() {
  const params = useParams();
  const streamId = params.id as string;
  const [copied, setCopied] = useState(false);

  const truncatedId = `${streamId.slice(0, 13)}...${streamId.slice(-6)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(streamId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="flex max-w-7xl flex-col m-auto pt-8 px-8">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold">Information for: {truncatedId}</h1>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-sm font-normal text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          {copied ? 'Copied!' : 'Copy ID'}
        </button>
      </div>
      <div className="text-gray-600">
        Loading stream details...
      </div>
    </main>
  );
} 