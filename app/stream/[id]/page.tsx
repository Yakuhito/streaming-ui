'use client';

import { Address, Clvm, CoinsetClient, Puzzle, StreamedCatParsingResult } from 'chia-wallet-sdk-wasm';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StreamData {
  parsedStreams: StreamedCatParsingResult[] | null;
}

export default function StreamPage() {
  const params = useParams();
  const streamIdString = params.id as string;
  const [copied, setCopied] = useState(false);
  const [streamData, setStreamData] = useState<StreamData | null>(null);

  const truncatedId = `${streamIdString.slice(0, 13)}...${streamIdString.slice(-6)}`;

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

            let parsedStreams: StreamedCatParsingResult[] = [streamInfo];

            let latestStreamResult = streamInfo;
            while (!latestStreamResult.lastSpendWasClawback) {
                let coinRecordResp = await client.getCoinRecordByName(latestStreamResult.streamedCat!.coin.coinId());
                if (!coinRecordResp.success || !coinRecordResp.coinRecord || !coinRecordResp.coinRecord?.spent) {
                    break;
                }

                let coinSpend = (await client.getPuzzleAndSolution(coinRecordResp.coinRecord!.coin.coinId(), coinRecordResp.coinRecord!.spentBlockIndex)).coinSolution!;
                let parsed = puzz.parseChildStreamedCat(coinSpend.coin, ctx.deserialize(coinSpend.puzzleReveal), ctx.deserialize(coinSpend.solution))!;
                
                parsedStreams.push(parsed);
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
        <h1 className="text-2xl font-semibold">Information for: {truncatedId}</h1>
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
        </div>) : (<div>TODO</div>)
    } 
    </main>
  );
} 