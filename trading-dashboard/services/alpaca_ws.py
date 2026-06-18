"""Stream real-time stock data using Alpaca's WebSocket API.
Requires Alpaca API key and secret set as environment variables:
ALPACA_API_KEY and ALPACA_API_SECRET.
"""
import asyncio
import os
from alpaca_trade_api.stream import Stream

API_KEY = os.getenv('ALPACA_API_KEY')
API_SECRET = os.getenv('ALPACA_API_SECRET')
BASE_URL = os.getenv('ALPACA_BASE_URL', 'https://paper-api.alpaca.markets')

async def trade_updates(data):
    print('Trade update:', data)

async def quote_updates(data):
    print('Quote update:', data)

async def main():
    stream = Stream(ALPACA_API_KEY, ALPACA_API_SECRET, base_url=BASE_URL, data_feed='iex')
    # Subscribe to trade and quote updates for AAPL
    stream.subscribe_trades(trade_updates, 'AAPL')
    stream.subscribe_quotes(quote_updates, 'AAPL')
    await stream._run_forever()

if __name__ == '__main__':
    asyncio.run(main())
