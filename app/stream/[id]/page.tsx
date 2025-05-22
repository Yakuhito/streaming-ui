'use client';

import Footer from '@/app/components/Footer';
import { WalletConnectCoin, WalletConnectCoinSpend } from '@/app/lib/WalletConnect';
import walletConnect from '@/app/lib/walletConnectInstance';
import { useAppSelector } from '@/app/redux/hooks';
import { Address, Clvm, CoinSpend, CoinsetClient, fromHex, Program, PublicKey, Signature, SpendBundle, standardPuzzleHash, StreamedCatParsingResult, toHex, Coin } from 'chia-wallet-sdk-wasm';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StreamData {
  parsedStreams: [number, bigint, StreamedCatParsingResult][] | null;
  lastCoinId: Uint8Array | null;
  unspentStream: StreamedCatParsingResult | null;
}

function coinForWalletInterface(coin: Coin): WalletConnectCoin {
return new WalletConnectCoin(toHex(coin.parentCoinInfo), toHex(coin.puzzleHash), Number(coin.amount));
}

function coinSpendForWalletInterface(coinSpend: CoinSpend): WalletConnectCoinSpend {
  return new WalletConnectCoinSpend(coinForWalletInterface(coinSpend.coin), toHex(coinSpend.puzzleReveal), toHex(coinSpend.solution));
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
            const ctx = new Clvm();

            let parsedStreams: [number, bigint, StreamedCatParsingResult][] = [];

            let firstRun = true;
            let latestCoinId = streamId;
            let latestStream: StreamedCatParsingResult | null = null;

            while(true) {
                let coinRecordResp = await client.getCoinRecordByName(latestCoinId);
                if(!coinRecordResp.success || !coinRecordResp.coinRecord) {
                    break;
                }

                if(firstRun) {
                    latestCoinId = coinRecordResp.coinRecord.coin.parentCoinInfo;
                    firstRun = false;
                    continue;
                }

                if(!coinRecordResp.coinRecord.spent) {
                    latestCoinId = coinRecordResp.coinRecord.coin.coinId();
                    break;
                }

                let puzzleAndSolution = await client.getPuzzleAndSolution(coinRecordResp.coinRecord.coin.coinId(), coinRecordResp.coinRecord.spentBlockIndex!);
                if(!puzzleAndSolution.success || !puzzleAndSolution.coinSolution) {
                    break;
                }

                let newStreamInfo = ctx.deserialize(puzzleAndSolution.coinSolution.puzzleReveal)
                    .puzzle()
                    .parseChildStreamedCat(
                        puzzleAndSolution.coinSolution.coin,
                        ctx.deserialize(puzzleAndSolution.coinSolution.solution)
                    )!;
                if(newStreamInfo.lastSpendWasClawback) {
                    parsedStreams.push([0, newStreamInfo.lastPaymentAmountIfClawback, latestStream!]);
                    break;
                }

                if(latestStream) {
                    parsedStreams.push([
                        coinRecordResp.coinRecord.spentBlockIndex!,
                        coinRecordResp.coinRecord.coin.amount - (newStreamInfo.streamedCat?.coin.amount ?? BigInt(0)),
                        latestStream
                    ]);
                }

                latestCoinId = newStreamInfo.streamedCat!.coin.coinId();
                latestStream = newStreamInfo;
            }

            console.log("Parsed streams #: ", parsedStreams.length);
            if (parsedStreams?.length ?? 0 > 0) {
                if (
                    parsedStreams[parsedStreams.length - 1][0] === 0 ||
                    parsedStreams[parsedStreams.length - 1][2].streamedCat?.info.lastPaymentTime === parsedStreams[parsedStreams.length - 1][2].streamedCat?.info.endTime
                ) {
                    console.log('no unspent stream');
                    setStreamData({ parsedStreams: parsedStreams, lastCoinId: latestCoinId, unspentStream: null });
                } else {
                    console.log('unspent stream');
                    setStreamData({ parsedStreams: parsedStreams, lastCoinId: null, unspentStream: latestStream });
                }
            } else {
                console.log('unspent stream');
                setStreamData({ parsedStreams: parsedStreams, lastCoinId: null, unspentStream: latestStream });
            }

            // Update saved streams in localStorage - remove if exists and add as last element
            const savedStreams = JSON.parse(localStorage.getItem('savedStreams') || '[]');
            const filteredStreams = savedStreams.filter((id: string) => id !== streamIdString);
            filteredStreams.push(streamIdString);
            localStorage.setItem('savedStreams', JSON.stringify(filteredStreams));

        })()
    }
  }, [streamData]);

  return (
    <main className="flex max-w-7xl flex-col m-auto pt-8 px-2 sm:px-8 bg-white text-black">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold xl:hidden">{truncatedId}</h1>
        <h1 className="text-2xl font-semibold xl:block hidden">{streamIdString}</h1>
        <button
          onClick={handleCopy}
          className="sm:hidden block px-3 py-1 text-sm font-normal text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleCopy}
          className="hidden sm:block px-3 py-1 text-sm font-normal text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          {copied ? 'Copied!' : 'Copy ID'}
        </button>
      </div>
      {
        streamData === null ? (<div className="text-gray-600">
            Loading stream details...
        </div>) : (streamData?.parsedStreams ? (<StreamInfo streamData={streamData} />) : (<div className="text-gray-600">
            Error loading stream.
        </div>))
    } 
    </main>
  );
} 

function StreamInfo({ streamData }: { streamData: StreamData }) {
    let firstStream: [number, bigint, StreamedCatParsingResult | null] = [0, BigInt(0),streamData.unspentStream];
    if(streamData.parsedStreams?.length ?? 0 > 0) {
        firstStream = streamData.parsedStreams![0];
    }
    const unspentStream = streamData.unspentStream;
    
    // Get the streaming info from the first stream
    const firstStreamInfo = firstStream[2]!.streamedCat?.info;
    const unspentStreamInfo = unspentStream?.streamedCat?.info;
    
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

    const clawedBack = streamData.parsedStreams!.length > 0 && streamData.parsedStreams![streamData.parsedStreams!.length - 1][0] === 0;

    const totalAmount = firstStream[2]!.streamedCat!.coin.amount;
    let claimedAmount = (streamData.parsedStreams ?? []).filter(s => s[0] !== 0 && s[2].streamedCat).map(s => s[1]).reduce((a, b) => a + b, BigInt(0));
    if (clawedBack) {
        claimedAmount += streamData.parsedStreams![streamData.parsedStreams?.length! - 1][1];
    }

    let timestamp_now = currentTime;
    if (unspentStreamInfo && timestamp_now > unspentStreamInfo?.endTime) {
        timestamp_now = unspentStreamInfo!.endTime;
    }
    if (unspentStreamInfo && timestamp_now < unspentStreamInfo?.lastPaymentTime) {
        timestamp_now = unspentStreamInfo!.lastPaymentTime;
    }
    let claimableAmount = BigInt(0);
    if (unspentStream?.streamedCat && unspentStream?.streamedCat!.coin.amount > 0) {
        // we're here if the stream is not over & last spend was not a clawback
        claimableAmount = unspentStream.streamedCat!.info.amountToBePaid(unspentStream?.streamedCat!.coin.amount, timestamp_now);
    }

    let amountLeftToStream = totalAmount - claimableAmount - claimedAmount;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Stream Information</h2>

            <ProgressBar 
                claimedAmount={claimedAmount}
                claimableAmount={claimableAmount}
                amountLeftToStream={amountLeftToStream}
                totalAmount={totalAmount}
                clawback={clawedBack}
            />

            <div className="overflow-x-auto xl:m-8 md:m-4">
                <table className="min-w-full border border-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Asset Id</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                <Link href={`https://dexie.space/assets/${toHex(firstStream[2]!.streamedCat!.assetId)}`} className="text-blue-500 hover:text-blue-600 underline" target="_blank">
                                    <span className="hidden lg:inline">{toHex(firstStream[2]!.streamedCat!.assetId)}</span>
                                    <span className="lg:hidden">{truncateAddress(toHex(firstStream[2]!.streamedCat!.assetId))}</span>
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
                                {formatDate(unspentStreamInfo?.lastPaymentTime ?? firstStreamInfo?.endTime ?? BigInt(0))} {unspentStream ? <ClaimButton lastParsedStream={unspentStream} isClawback={false} /> : ''}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 border-r border-gray-200 w-1/4">Clawed Back</td>
                            <td className="px-6 py-4 text-sm text-gray-900 w-3/4">
                                {clawedBack ? "Yes" : "No"} {unspentStream && firstStreamInfo?.clawbackPh ? <ClaimButton lastParsedStream={unspentStream} isClawback={true} /> : ''}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h2 className="text-xl font-semibold mt-8">Transactions</h2>
            <ul className="list-disc pl-5 space-y-2"> { streamData.parsedStreams!.map(([spentBlockHeight, amountClaimed, parseResult]) => {
                if(spentBlockHeight === 0) {
                    return (
                        <li key={spentBlockHeight}>
                            <CoinElement coinId={streamData.lastCoinId!} /> clawed back; last payment was {(Number(amountClaimed) / 1000).toString()} CATs.
                        </li>
                    );
                }

                return (
                    <li key={toHex(parseResult.streamedCat!.coin.coinId())}>
                        <CoinElement coinId={parseResult.streamedCat!.coin.coinId()} /> spent at block {spentBlockHeight} to claim {Number(amountClaimed) / 1000} CATs.
                    </li>
                );
            }) }
            {streamData.unspentStream && (streamData.unspentStream.streamedCat?.coin.amount ?? 0 > 0) ? (
                <li key={"last-unspent"}>
                    <CoinElement coinId={streamData.unspentStream.streamedCat?.coin.coinId()!} /> currently unspent.
                </li>
            ) : <></>}
            </ul>

            <Footer />
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

function CoinElement({ coinId }: { coinId?: Uint8Array }) {
    if(!coinId) {
        return <span>Coin{' '}</span>;
    }

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
        let address = new Address(lastParsedStream.streamedCat!.info.recipient!, 'xch').encode();
        if (isClawback) {
            address = new Address(lastParsedStream.streamedCat!.info.clawbackPh!, 'xch').encode();
        }

        let startIndex = 0;
        let publicKey: string | null = null;
        while (!publicKey && startIndex < 100000) {
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
        
        let claimTime = Math.floor(new Date().getTime() / 1000) - 120;
        if(isClawback) {
            claimTime += 120 + 300; // 5 mins in the future
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
        let leadCoinId = toHex(leadCoin.coinId());

        console.log('a'); // todo: debug
        let conditions: Program[] = [
            ctx.sendMessage(23, ctx.int(BigInt(claimTime)).toAtom()!, [ctx.atom(streamedCat.coin.coinId())]),
            ctx.reserveFee(neededAmount),
        ];
        console.log('b'); // todo: debug
        if (totalAmount > neededAmount) {
            console.log('c'); // todo: debug
            conditions.push(ctx.createCoin(leadCoin.puzzleHash, totalAmount - neededAmount, null));
            console.log('d'); // todo: debug
        }

        console.log('e'); // todo: debug
        // ctx.spendStandardCoin(leadCoin, PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend(conditions));
        ctx.spendCoin(leadCoin, ctx.standardSpend(PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend(conditions)));

        console.log('f'); // todo: debug
        if (includedCoins.length > 1) {
            console.log('g'); // todo: debug
            for (let i = 1; i < includedCoins.length; i++) {
                console.log('h'); // todo: debug
                // ctx.spendStandardCoin(includedCoins[i], PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend([
                //     ctx.assertConcurrentSpend(leadCoin.coinId())
                // ]));
                ctx.spendCoin(includedCoins[i], ctx.standardSpend(PublicKey.fromBytes(fromHex(publicKey)), ctx.delegatedSpend([
                    ctx.assertConcurrentSpend(fromHex(leadCoinId))
                ])));
                console.log('i'); // todo: debug
            }
        }

        console.log('j'); // todo: debug
        let streamedCatCoinId = streamedCat.coin.coinId();
        ctx.spendStreamedCat(streamedCat, BigInt(claimTime), isClawback);
        console.log('k'); // todo: debug

        const coinSpends = ctx.coinSpends();

        setButtonText("[Wallet Prompt] Awaiting signature...");
        const signature = await walletConnect.signCoinSpends(coinSpends.map(c => coinSpendForWalletInterface(c)), false, true);
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