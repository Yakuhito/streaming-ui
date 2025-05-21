'use client';

import { WalletConnectCoinSpend } from '@/app/lib/WalletConnect';
import walletConnect from '@/app/lib/walletConnectInstance';
import { useAppSelector } from '@/app/redux/hooks';
import { Address, Clvm, CoinsetClient, fromHex, Program, PublicKey, Puzzle, Signature, Spend, SpendBundle, standardPuzzleHash, StreamedCatParsingResult, toHex } from 'chia-wallet-sdk-wasm';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StreamData {
  parsedStreams: [number, StreamedCatParsingResult][] | null;
}

export default function StreamPage() {
  const params = useParams();
  const streamIdString = params.id as string;
  const [copied, setCopied] = useState(false);
  const [streamData, setStreamData] = useState<StreamData | null>(null);

  const truncatedId = `${streamIdString.slice(0, 10)}...${streamIdString.slice(-3)}`;

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

            let parsedStreams: [number, StreamedCatParsingResult][] = [[eveCoinRecord.spentBlockIndex!, streamInfo]];

            let latestStreamResult = streamInfo;
            let coinRecordResp = eveCoinRecordResponse;
            let coinSpend = eveCoinSpend;
            while (!latestStreamResult.lastSpendWasClawback) {
                coinRecordResp = await client.getCoinRecordByName(latestStreamResult.streamedCat!.coin.coinId());
                if (!coinRecordResp.success || !coinRecordResp.coinRecord || !coinRecordResp.coinRecord?.spent) {
                    break;
                }

                coinSpend = (await client.getPuzzleAndSolution(coinRecordResp.coinRecord!.coin.coinId(), coinRecordResp.coinRecord!.spentBlockIndex)).coinSolution!;
                let parsed = puzz.parseChildStreamedCat(coinSpend.coin, ctx.deserialize(coinSpend.puzzleReveal), ctx.deserialize(coinSpend.solution))!;
                
                parsedStreams.push([coinRecordResp.coinRecord.spentBlockIndex!, parsed]);
                latestStreamResult = parsed;
            }

            console.log("Parsed streams #: ", parsedStreams.length);
            setStreamData({ parsedStreams: parsedStreams });

            // Update saved streams in localStorage - remove if exists and add as last element
            const savedStreams = JSON.parse(localStorage.getItem('savedStreams') || '[]');
            const filteredStreams = savedStreams.filter((id: string) => id !== streamIdString);
            filteredStreams.push(streamIdString);
            localStorage.setItem('savedStreams', JSON.stringify(filteredStreams));

        })()
    }
  }, [streamData]);

  return (
    <main className="flex max-w-7xl flex-col m-auto pt-8 px-8 bg-white text-black">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold xl:hidden">{truncatedId}</h1>
        <h1 className="text-2xl font-semibold xl:block hidden">{streamIdString}</h1>
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

function StreamInfo({ parsedStreams }: { parsedStreams: [number, StreamedCatParsingResult][]}) {
    const firstStream = parsedStreams[0];
    const lastStream = parsedStreams[parsedStreams.length - 1];
    
    // Get the streaming info from the first stream
    const firstStreamInfo = firstStream[1].streamedCat?.info;
    const lastStreamInfo = lastStream[1].streamedCat?.info;
    
    const [currentTime, setCurrentTime] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000) - 120));

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(BigInt(Math.floor(Date.now() / 1000) - 120));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatDate = (timestamp: bigint) => {
        return new Date(Number(timestamp) * 1000).toLocaleString();
    };

    const formatPuzzleHash = (ph: Uint8Array | undefined) => {
        if (!ph) return "Disabled";
        return new Address(ph, "xch").encode();
    };

    const truncateAddress = (address: string) => {
        if (address === "Disabled") return address;
        return `${address.slice(0, 7)}...${address.slice(-3)}`;
    };

    const totalAmount = firstStream[1].streamedCat!.coin.amount;
    const unclaimedAmount = lastStream[1].streamedCat!.coin.amount;
    let claimedAmount = totalAmount - unclaimedAmount;

    let timestamp_now = currentTime;
    if (timestamp_now > lastStreamInfo!.endTime) {
        timestamp_now = lastStreamInfo!.endTime;
    }
    if (timestamp_now < lastStreamInfo!.lastPaymentTime) {
        timestamp_now = lastStreamInfo!.lastPaymentTime;
    }
    let claimableAmount = BigInt(0);
    if (lastStream[1].lastSpendWasClawback) {
        claimableAmount = BigInt(0);
        claimableAmount += lastStream[1].lastPaymentAmountIfClawback;
    } else {
        if (lastStreamInfo?.lastPaymentTime !== lastStreamInfo?.endTime) {
            // lastStreamInfo can be null if the stream is fully claimed
            claimableAmount = lastStreamInfo?.amountToBePaid(lastStream[1].streamedCat?.coin.amount ?? BigInt(0), timestamp_now) ?? BigInt(0);
        }
    }

    let amountLeftToStream = totalAmount - claimableAmount;

    // Calculate percentages ensuring they add up to exactly 100%
    const claimedPercentage = Number((claimedAmount * BigInt(100)) / totalAmount);
    const claimablePercentage = Number((claimableAmount * BigInt(100)) / totalAmount);
    const leftToStreamPercentage = 100 - claimedPercentage - claimablePercentage;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Stream Information</h2>

            <ProgressBar 
                claimedAmount={claimedAmount}
                claimableAmount={claimableAmount}
                amountLeftToStream={amountLeftToStream}
                totalAmount={totalAmount}
                clawback={lastStream[1].lastSpendWasClawback}
            />

            <div className="overflow-x-auto xl:m-8 md:m-4">
                <table className="min-w-full border border-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Asset Id</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                <Link href={`https://dexie.space/assets/${toHex(firstStream[1].streamedCat?.assetId ?? new Uint8Array())}`} className="text-blue-500 hover:text-blue-600 underline" target="_blank">
                                    <span className="hidden lg:inline">{toHex(firstStream[1].streamedCat?.assetId ?? new Uint8Array())}</span>
                                    <span className="lg:hidden">{truncateAddress(toHex(firstStream[1].streamedCat?.assetId ?? new Uint8Array()))}</span>
                                </Link>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Recipient</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                <span className="hidden lg:inline">{formatPuzzleHash(firstStreamInfo?.recipient)}</span>
                                <span className="lg:hidden">{truncateAddress(formatPuzzleHash(firstStreamInfo?.recipient))}</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Clawback</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                <span className="hidden lg:inline">{formatPuzzleHash(firstStreamInfo?.clawbackPh)}</span>
                                <span className="lg:hidden">{truncateAddress(formatPuzzleHash(firstStreamInfo?.clawbackPh))}</span>
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Last Claim</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {formatDate(lastStreamInfo?.lastPaymentTime ?? BigInt(0))} {!lastStream[1].lastSpendWasClawback ? <ClaimButton lastParsedStream={lastStream[1]} isClawback={false} /> : ''}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Clawed Back</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {lastStream[1].lastSpendWasClawback ? "Yes" : "No"} {!lastStream[1].lastSpendWasClawback ? <ClaimButton lastParsedStream={lastStream[1]} isClawback={true} /> : ''}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h2 className="text-xl font-semibold mt-8">Transactions</h2>
            <ul className="list-disc pl-5 space-y-2 pb-8"> { parsedStreams.map(([spentBlockHeight, parseResult], index) => {
                if (spentBlockHeight === 0) {
                    return (
                        <li key={spentBlockHeight}>
                            <Coin coinId={parseResult.streamedCat!.coin.coinId()} /> currently unspent.
                        </li>
                    );
                }
                
                if(parseResult.lastSpendWasClawback) {
                    return (
                        <li key={spentBlockHeight}>
                            <Coin coinId={parseResult.streamedCat!.coin.coinId()} /> clawed back at block {spentBlockHeight}; last payment was {(parseResult.lastPaymentAmountIfClawback / BigInt(1000)).toString()} CATs.
                        </li>
                    );
                }

                const currentAmount = parseResult.streamedCat!.coin.amount;
                const nextAmount = index < parsedStreams.length - 1 ? parsedStreams[index + 1][1].streamedCat!.coin.amount : BigInt(0);
                const claimedAmount = Number(currentAmount - nextAmount) / 1000;
                console.log({ currentAmount, nextAmount, claimedAmount });

                if (parseResult.streamedCat!.info.lastPaymentTime === parseResult.streamedCat!.info.endTime) {
                    return (
                        <li key={toHex(parseResult.streamedCat!.coin.coinId())}>
                            All value claimed.
                        </li>
                    );
                }

                return (
                    <li key={toHex(parseResult.streamedCat!.coin.coinId())}>
                        <Coin coinId={parseResult.streamedCat!.coin.coinId()} /> spent at block {spentBlockHeight} to claim {claimedAmount} CATs.
                    </li>
                );
            }) } </ul>
        </div>
    );
}

function FixedWidthNumber({ value }: { value: bigint }) {
    const formatted = (Number(value) / 1000).toFixed(3);
    const [whole, decimal] = formatted.split('.');
    
    return (
        <span className="font-mono inline-flex">
            {whole.split('').map((digit, i) => (
                <span key={`whole-${i}`} className="w-[1ch] text-center">{digit}</span>
            ))}
            <span className="w-[1ch] text-center">.</span>
            {decimal.split('').map((digit, i) => (
                <span key={`decimal-${i}`} className="w-[1ch] text-center">{digit}</span>
            ))}
        </span>
    );
}

function ProgressBar({ 
    claimedAmount, 
    claimableAmount, 
    amountLeftToStream,
    totalAmount,
    clawback 
}: { 
    claimedAmount: bigint;
    claimableAmount: bigint;
    amountLeftToStream: bigint;
    totalAmount: bigint;
    clawback: boolean;
}) {
    // Calculate percentages ensuring they add up to exactly 100%
    const claimedPercentage = Number((claimedAmount * BigInt(100 * 1000000)) / totalAmount) / 1000000;
    const claimablePercentage = Number((claimableAmount * BigInt(100 * 1000000)) / totalAmount) / 1000000;
    const leftToStreamPercentage = 100.0 - claimedPercentage - claimablePercentage;

    return (
        <div className="space-y-2 xl:m-8 md:m-4">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden relative">
                <div className="h-full flex w-full">
                    <div 
                        className="bg-blue-600 transition-all duration-1000 flex-shrink-0"
                        style={{ width: `${claimedPercentage}%` }}
                    />
                    <div 
                        className="bg-blue-400 animate-color-shift transition-all duration-1000 flex-shrink-0 relative overflow-hidden"
                        style={{ width: `${claimablePercentage}%` }}
                    />
                    <div 
                        className={`transition-all duration-1000 flex-shrink-0 ${clawback ? 'bg-red-600' : 'bg-gray-100'}`}
                        style={{ width: `${leftToStreamPercentage}%` }}
                    />
                </div>
            </div>
            <div className="flex justify-center pt-4 pb-6 xl:pb-4">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-2 md:gap-0 text-sm w-fit">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-600 rounded-sm flex-shrink-0"></div>
                        <span className="whitespace-nowrap">Claimed (<FixedWidthNumber value={claimedAmount} />)</span>
                    </div>
                    {!clawback ? (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-400 animate-color-shift rounded-sm flex-shrink-0"></div>
                            <span className="whitespace-nowrap">Claimable (<FixedWidthNumber value={claimableAmount} />)</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-600 rounded-sm flex-shrink-0"></div>
                            <span className="whitespace-nowrap">Clawed Back (<FixedWidthNumber value={amountLeftToStream} />)</span>
                        </div>
                    )}
                    {!clawback && (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-100 rounded-sm flex-shrink-0"></div>
                            <span className="whitespace-nowrap">To Stream (<FixedWidthNumber value={amountLeftToStream} />)</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Coin({ coinId }: { coinId: Uint8Array }) {
    let hexId = toHex(coinId);
    let truncatedId = `${hexId.slice(0, 4)}...${hexId.slice(-4)}`;
    return (
            <span>Coin <Link href={`https://www.spacescan.io/coin/0x${hexId}`} className="text-blue-500 hover:text-blue-600 underline" target="_blank">0x{truncatedId}</Link>{' '}</span>
    )
}

function ClaimButton({ lastParsedStream, isClawback }: { lastParsedStream: StreamedCatParsingResult, isClawback: boolean }) {
    const { address } = useAppSelector(state => state.wallet);
    const [buttonText, setButtonText] = useState(isClawback ? "Claw Back" : "Claim");
    const [fee, setFee] = useState<string>("");

    const handleClaim = async () => {
        setButtonText("Searching for public key...");
        let address = new Address(lastParsedStream.streamedCat!.info.clawbackPh!, 'xch').encode();
        if (!isClawback) {
            address = new Address(lastParsedStream.streamedCat!.info.recipient!, 'xch').encode();
        }

        let startIndex = 0;
        let publicKey: string | null = null;
        while (!publicKey && startIndex < 10000) {
            const keys = await walletConnect.getPublicKeys(500,startIndex);
            if (!keys) {
                break;
            }
            
            for (const key of keys) {
                if(new Address(standardPuzzleHash(PublicKey.fromBytes(fromHex(key))), 'xch').encode() === address) {
                    publicKey = key;
                    break;
                }
            }

            startIndex += 500;
        }

        if (publicKey === null) {
            alert("Could not find public key associated with clawback puzzle hash in the connected wallet");
            return;
        }

        setButtonText("Searching for source coin...");
        const coinset = CoinsetClient.mainnet();
        const p2PuzzleHash = standardPuzzleHash(PublicKey.fromBytes(fromHex(publicKey)));
        let coinRecords = (await coinset.getCoinRecordsByPuzzleHash(p2PuzzleHash, null, null, false)).coinRecords ?? [];

        let neededAmount = BigInt(Math.floor(parseFloat(fee) * 1e12));
        if(neededAmount === BigInt(0)) {
            neededAmount = BigInt(1);
        }


        if (coinRecords.length === 0 || coinRecords.map(c => c.coin.amount).reduce((a, b) => a + b, BigInt(0)) < neededAmount) {
            setButtonText("[Wallet Prompt]Sending coins to the right address...");
            await walletConnect.sendAsset("", new Address(p2PuzzleHash, 'xch').encode(), neededAmount.toString(), neededAmount.toString(), []);
            setButtonText("Waiting for source coin...");
        }

        while(coinRecords.filter(c => !c.spent).map(c => c.coin.amount).reduce((a, b) => a + b, BigInt(0)) < neededAmount ) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            coinRecords = (await coinset.getCoinRecordsByPuzzleHash(p2PuzzleHash, null, null, false)).coinRecords ?? [];
        }

        setButtonText("Preparing transaction...");
        const ctx = new Clvm();
        const streamedCat = lastParsedStream.streamedCat!;
        
        let claimTime = Math.floor(new Date().getTime() / 1000) - 60;
        if(isClawback) {
            claimTime += 60 + 600; // 10 mins in the future
        }
        if (claimTime > lastParsedStream.streamedCat!.info.endTime) {
            claimTime = Number(lastParsedStream.streamedCat!.info.endTime);
        }

        let includedCoins = [];
        let totalAmount = BigInt(0);
        while(totalAmount < neededAmount) {
            totalAmount += coinRecords[includedCoins.length].coin.amount;
            includedCoins.push(coinRecords[includedCoins.length].coin);
        }
        const leadCoin = includedCoins[0];
        
        let conditions: Program[] = [
            ctx.sendMessage(23, ctx.int(claimTime).toAtom()!, [ctx.atom(streamedCat.coin.coinId())]),
            ctx.reserveFee(neededAmount),
        ];
        if (totalAmount > neededAmount) {
            conditions.push(ctx.createCoin(leadCoin.puzzleHash, totalAmount - neededAmount, null));
        }

        // ctx.spendStandardCoin(leadCoin, PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend(conditions));
        ctx.spendCoin(leadCoin, ctx.standardSpend(PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend(conditions)));

        if (includedCoins.length > 1) {
            for (let i = 1; i < includedCoins.length; i++) {
                // ctx.spendStandardCoin(includedCoins[i], PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend([
                //     ctx.assertConcurrentSpend(leadCoin.coinId())
                // ]));
                ctx.spendCoin(includedCoins[i], ctx.standardSpend(PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend([
                    ctx.assertConcurrentSpend(leadCoin.coinId())
                ])));
            }
        }

        let streamedCatCoinId = streamedCat.coin.coinId();
        ctx.spendStreamedCat(streamedCat, BigInt(claimTime), isClawback);

        const coinSpends = ctx.coinSpends();

        setButtonText("[Wallet Prompt] Awaiting signature...");
        const signature = await walletConnect.signCoinSpends(coinSpends.map(c => WalletConnectCoinSpend.fromCoinSpend(c)), false, true);
        console.log({ signature });

        setButtonText("Submitting bundle...");
        let resp = await coinset.pushTx(new SpendBundle(coinSpends, Signature.fromBytes(fromHex(signature!.replace('0x', '')))));
        console.log({ resp });

        if (!resp.success || resp.status !== "SUCCESS") {
            alert("Failed to submit bundle with status: " + resp.status + " and error: " + resp.error);
            return;
        }

        setButtonText("Awaiting block inclusion...");
        let coinRecord = await coinset.getCoinRecordByName(streamedCatCoinId);
        while(!coinRecord.coinRecord?.spent) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            coinRecord = await coinset.getCoinRecordByName(streamedCatCoinId);
        }

        setButtonText("Refreshing...");
        window.location.reload();
    }

    const disabled = buttonText !== (isClawback ? "Claw Back" : "Claim") || !fee;

    return address && (
        <div className="inline-flex items-center gap-x-1 ml-4">
            <input
                type="text"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="Fee"
                className="w-24 px-2 py-0.25 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
                onClick={handleClaim}
                className={`px-2 py-0.5 font-normal text-white rounded-lg transition-colors ${disabled ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"}`}
                disabled={disabled}
            >
                {buttonText}
            </button>
        </div>
    );
}