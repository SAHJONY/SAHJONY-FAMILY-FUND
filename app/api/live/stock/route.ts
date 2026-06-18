import { NextResponse } from 'next/server';
import Alpaca from '@alpacahq/alpaca-trade-api';

// Environment variables should contain your Alpaca paper keys
const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY || '',
  secretKey: process.env.ALPACA_API_SECRET || '',
  paper: true,
});

export const dynamic = 'force-dynamic'; // ensure serverless function runs on each request

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      // Simple polling every 2 seconds for latest price of a symbol list
      const symbols = ['AAPL', 'MSFT', 'GOOGL'];
      const interval = setInterval(async () => {
        try {
          const quotes = await Promise.all(
            symbols.map((sym) => alpaca.getLatestQuote(sym).catch(() => null))
          );
          const data = quotes.map((q, i) => ({ symbol: symbols[i], price: q?.AskPrice ?? q?.BidPrice ?? null }));
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch (e) {
          // ignore errors to keep stream alive
        }
      }, 2000);

      // Cleanup when client disconnects
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
