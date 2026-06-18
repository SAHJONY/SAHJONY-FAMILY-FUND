"""Connect to a crypto exchange via CCXT WebSocket and stream ticker data.
Replace 'binance' with your preferred exchange that supports WebSocket in CCXT.
"""
import asyncio
import ccxt.async_support as ccxt

async def main():
    exchange = ccxt.binance({
        'enableRateLimit': True,
    })
    # Subscribe to ticker for BTC/USDT
    while True:
        try:
            ticker = await exchange.fetch_ticker('BTC/USDT')
            print(ticker)
            await asyncio.sleep(1)  # adjust rate as needed
        except Exception as e:
            print('Error:', e)
            await asyncio.sleep(5)

if __name__ == '__main__':
    asyncio.run(main())
