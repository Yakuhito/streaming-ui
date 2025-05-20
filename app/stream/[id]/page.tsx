'use client';

import { Address, Clvm, CoinsetClient, Puzzle, StreamedCatParsingResult } from 'chia-wallet-sdk-wasm';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StreamData {
  parsedStreams: [number, StreamedCatParsingResult][] | null;
}

export default function StreamPage() {
  const params = useParams();
  const streamIdString = params.id as string;
  const [copied, setCopied] = useState(false);
  const [streamData, setStreamData] = useState<StreamData | null>(null);

  const truncatedId = `${streamIdString.slice(0, 13)}...${streamIdString.slice(-9)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(streamIdString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if(streamData === null) {
        (async () => {
            const streamId = Address.decode(streamIdString).puzzleHash;
            const client = CoinsetClient.mainnet();

            const eveCoinRecordResponse = await client.getCoinRecordByName(streamId);
            if (!eveCoinRecordResponse.success ) {
                alert('Could not fetch eve coin record - stream id may not be valid.');
                return;
            }
        
            const eveCoinRecord = eveCoinRecordResponse.coinRecord!;
            const eveCoinSpend = (await client.getPuzzleAndSolution(eveCoinRecord.coin.parentCoinInfo, eveCoinRecord.confirmedBlockIndex)).coinSolution!;

            const ctx = new Clvm();

            const puzz = new Puzzle(eveCoinSpend.coin.puzzleHash, ctx.deserialize(eveCoinSpend.puzzleReveal), eveCoinSpend.coin.puzzleHash);
            const streamInfo = puzz.parseChildStreamedCat(eveCoinSpend.coin, ctx.deserialize(eveCoinSpend.puzzleReveal), ctx.deserialize(eveCoinSpend.solution))!;

            let parsedStreams: [number, StreamedCatParsingResult][] = [[eveCoinRecord.confirmedBlockIndex!, streamInfo]];

            let latestStreamResult = streamInfo;
            while (!latestStreamResult.lastSpendWasClawback) {
                let coinRecordResp = await client.getCoinRecordByName(latestStreamResult.streamedCat!.coin.coinId());
                if (!coinRecordResp.success || !coinRecordResp.coinRecord || !coinRecordResp.coinRecord?.spent) {
                    break;
                }

                let coinSpend = (await client.getPuzzleAndSolution(coinRecordResp.coinRecord!.coin.coinId(), coinRecordResp.coinRecord!.spentBlockIndex)).coinSolution!;
                let parsed = puzz.parseChildStreamedCat(coinSpend.coin, ctx.deserialize(coinSpend.puzzleReveal), ctx.deserialize(coinSpend.solution))!;
                
                parsedStreams.push([coinRecordResp.coinRecord.spentBlockIndex!, parsed]);
                latestStreamResult = parsed;
            }

            console.log("Parsed streams #: ", parsedStreams.length);
            setStreamData({ parsedStreams: parsedStreams });

        })()
    }
  }, [streamData]);

  return (
    <main className="flex max-w-7xl flex-col m-auto pt-8 px-8">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold">{truncatedId}</h1>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-sm font-normal text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          {copied ? 'Copied!' : 'Copy ID'}
        </button>
      </div>
      {
        streamData === null ? (<div className="text-gray-600">
            Loading stream details...
        </div>) : (streamData?.parsedStreams?.length ?? 0 > 0 ? (<StreamInfo parsedStreams={streamData.parsedStreams!} />) : (<div className="text-gray-600">
            Error loading stream.
        </div>))
    } 
    </main>
  );
} 

function StreamInfo({ parsedStreams }: { parsedStreams: [number, StreamedCatParsingResult][] }) {
    const firstStream = parsedStreams[0];
    const lastStream = parsedStreams[parsedStreams.length - 1];
    
    // Get the streaming info from the first stream
    const firstStreamInfo = firstStream[1].streamedCat?.info;
    const lastStreamInfo = lastStream[1].streamedCat?.info;
    
    const formatDate = (timestamp: bigint) => {
        return new Date(Number(timestamp) * 1000).toLocaleString();
    };

    const formatPuzzleHash = (ph: Uint8Array | undefined) => {
        if (!ph) return "Disabled";
        return new Address(ph, "xch").encode();
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Stream Information</h2>
            <div className="overflow-x-auto bg:m-8">
                <table className="min-w-full border border-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Asset Id</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {Buffer.from(firstStream[1].streamedCat?.assetId ?? new Uint8Array()).toString('hex')}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Recipient</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {formatPuzzleHash(firstStreamInfo?.recipient)}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Clawback</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {formatPuzzleHash(firstStreamInfo?.clawbackPh)}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Creation Height</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {firstStream[0]}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Start</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {formatDate(firstStreamInfo?.lastPaymentTime ?? BigInt(0))}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">End</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {formatDate(firstStreamInfo?.endTime ?? BigInt(0))}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Last Claim Time</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {formatDate(lastStreamInfo?.lastPaymentTime ?? BigInt(0))}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Clawed Back</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {lastStream[1].lastSpendWasClawback ? "Yes" : "No"}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <h2 className="text-xl font-semibold mt-8">Transactions</h2>
        </div>
    );
}