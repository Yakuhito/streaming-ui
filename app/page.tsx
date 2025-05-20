'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <main className="flex max-w-7xl flex-col justify-center m-auto red-300 pt-8 px-8">
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
      TODO
      <h1 className="text-xl mt-8 mb-4">New Stream</h1>
      TODO
    </main>
  );
}
