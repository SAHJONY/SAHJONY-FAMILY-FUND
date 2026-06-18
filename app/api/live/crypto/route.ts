import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// No API key needed for public ticker data; you can add keys for private endpoints later.
const exchange = new ccxt.binance({ enableRateLimit: true });

export const dynamic = 'force-dynamic';

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
      const interval = setInterval(async () => {
        try {
          const tickers = await Promise.all(
            symbols.map((sym) => exchange.fetchTicker(sym).catch(() => null))
          );
          const data = tickers.map((t, i) => ({ symbol: symbols[i], price: t?.last ?? null }));
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch (e) {
          // keep alive on errors
        }
      }, 2000);
      // @ts-ignore: ignore missing signal on controller
    (controller as any).signal?.addEventListener('abort', () => clearInterval(interval));
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
