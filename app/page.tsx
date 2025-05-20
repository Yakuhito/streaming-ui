'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function RecentStreams() {
  const [recentStreams, setRecentStreams] = useState<string[]>([]);

  useEffect(() => {
    const savedStreams = JSON.parse(localStorage.getItem('savedStreams') || '[]');
    setRecentStreams(savedStreams.slice(-50).reverse()); // Get last 50 and reverse for most recent first
  }, []);

  const handleDelete = (streamId: string) => {
    const savedStreams = JSON.parse(localStorage.getItem('savedStreams') || '[]');
    const updatedStreams = savedStreams.filter((id: string) => id !== streamId);
    localStorage.setItem('savedStreams', JSON.stringify(updatedStreams));
    setRecentStreams(updatedStreams.slice(-50).reverse());
  };

  if (recentStreams.length === 0) {
    return <div className="text-gray-600 text-center">No history found</div>;
  }

  return (
    <ul className="space-y-2 list-disc pl-5">
      {recentStreams.map((streamId) => (
        <li key={streamId} className="items-center">
          <Link
            href={`/stream/${streamId}`}
            className="text-blue-500 hover:text-blue-600 hover:underline"
          >
            <span className="hidden lg:inline">{streamId}</span>
            <span className="lg:hidden">{`${streamId.slice(0, 10)}...${streamId.slice(-3)}`}</span>
          </Link>
          <button
            onClick={() => handleDelete(streamId)}
            className="text-red-500 hover:text-red-600 text-lg font-bold ml-2"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const [searchInput, setSearchInput] = useState('');
  const router = useRouter();

  const handleSearch = () => {
    router.push(`/stream/${searchInput}`);
  };

  const setSearchInputAndPossiblyRedirect = (value: string) => {
    setSearchInput(value);
    if (value.length === 65 && value.startsWith('stream1')) {
      router.push(`/stream/${value}`);
    }
  };

  return (
    <main className="flex max-w-7xl flex-col justify-center m-auto pt-8 px-8 bg-white text-black">
      <h1 className="text-xl mb-4">View Stream</h1>
      <div className="flex gap-2 w-full max-w-2xl m-auto">
        <input
          type="text"
          placeholder="stream1.."
          value={searchInput}
          minLength={65}
          maxLength={65}
          onChange={(e) => setSearchInputAndPossiblyRedirect(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 font-normal text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          View Stream
        </button>
      </div>
      <h1 className="text-xl mt-8 mb-4">Recent Streams</h1>
      <RecentStreams />
      <h1 className="text-xl mt-8 mb-4">New Stream</h1>
      TODO
    </main>
  );
}
