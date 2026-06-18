"""FastAPI server that runs background tasks to fetch data from OpenBB, CCXT, Alpaca.
Install fastapi and uvicorn via requirements.txt if needed.
"""
import asyncio
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present (development)
env_path = Path(__file__).parent / ".env"
if env_path.is_file():
    load_dotenv(dotenv_path=env_path)

app = FastAPI()

# Simple in‑memory store for live data
store = {
    "news": [],
    "fundamentals": {},
    "crypto_ticker": {},
    "stock_quote": {},
}

# Endpoints --------------------------------------------------------------
@app.get("/news")
async def get_news():
    return JSONResponse(content=store["news"])

@app.get("/fundamentals/{symbol}")
async def get_fundamentals(symbol: str):
    return JSONResponse(content=store["fundamentals"].get(symbol, {}))

@app.get("/crypto/{symbol}")
async def get_crypto(symbol: str):
    return JSONResponse(content=store["crypto_ticker"].get(symbol, {}))

@app.get("/stock/{symbol}")
async def get_stock(symbol: str):
    return JSONResponse(content=store["stock_quote"].get(symbol, {}))

# ---------------------------------------------------------------------
# Background tasks – real implementations
# ---------------------------------------------------------------------
async def alpaca_stream():
    """Connect to Alpaca WebSocket and update ``store['stock_quote']``.
    Expects ``ALPACA_API_KEY`` and ``ALPACA_API_SECRET`` in the environment.
    """
    from alpaca_trade_api.stream import Stream
    api_key = os.getenv("ALPACA_API_KEY")
    api_secret = os.getenv("ALPACA_API_SECRET")
    base_url = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
    if not api_key or not api_secret:
        return
    async def quote_update(data):
        # data contains symbol, bidprice, askprice, etc.
        symbol = data.get("S") or data.get("symbol")
        if symbol:
            store["stock_quote"][symbol] = data
    stream = Stream(api_key, api_secret, base_url=base_url, data_feed="iex")
    # Subscribe to quotes for a configurable list (comma‑separated env var)
    symbols = os.getenv("ALPACA_SYMBOLS", "AAPL,MSFT,GOOG").split(",")
    for s in symbols:
        stream.subscribe_quotes(quote_update, s.strip())
    await stream._run_forever()

async def ccxt_stream():
    """Poll CCXT exchange ticker and update ``store['crypto_ticker']``.
    Default exchange is Binance; you can override via ``CCXT_EXCHANGE``.
    """
    import ccxt.async_support as ccxt
    exchange_name = os.getenv("CCXT_EXCHANGE", "binance")
    exch_class = getattr(ccxt, exchange_name, None)
    if not exch_class:
        return
    exchange = exch_class({"enableRateLimit": True})
    # Symbol list from env var, default BTC/USDT
    symbols = os.getenv("CCXT_SYMBOLS", "BTC/USDT,ETH/USDT").split(",")
    async def fetch_loop():
        while True:
            try:
                for sym in symbols:
                    ticker = await exchange.fetch_ticker(sym.strip())
                    store["crypto_ticker"][sym.strip()] = ticker
                await asyncio.sleep(1)
            except Exception as e:
                print("CCXT error", e)
                await asyncio.sleep(5)
    await fetch_loop()

async def openbb_fetch():
    """Pull news and fundamentals via OpenBB and store them.
    Requires ``OPENBB_API_KEY`` if using the cloud version.
    """
    from openbb import openbb
    # Simple example – fetch latest news for a configurable query
    query = os.getenv("OPENBB_NEWS_QUERY", "stock market")
    limit = int(os.getenv("OPENBB_NEWS_LIMIT", "5"))
    try:
        news = openbb.news.search(query, limit=limit)
        store["news"] = news
    except Exception as e:
        print("OpenBB news error", e)
    # Fundamentals for a list of symbols
    symbols = os.getenv("OPENBB_FUNDS_SYMBOLS", "AAPL,MSFT,GOOG").split(",")
    for sym in symbols:
        try:
            fund = openbb.equity.fundamentals(sym.strip())
            store["fundamentals"][sym.strip()] = fund
        except Exception as e:
            print(f"OpenBB fundamentals error for {sym}", e)

# ---------------------------------------------------------------------
# Alerts helper – trigger webhook when price moves > threshold
# ---------------------------------------------------------------------
async def price_alerts():
    """Monitor ``store`` for price jumps and POST to ``ALERT_WEBHOOK_URL``.
    The percent threshold is configurable via ``ALERT_THRESHOLD`` (default 5%).
    """
    import httpx
    url = os.getenv("ALERT_WEBHOOK_URL")
    if not url:
        return
    threshold = float(os.getenv("ALERT_THRESHOLD", "5"))
    last_prices: dict[str, float] = {}
    while True:
        # Check crypto prices
        for sym, data in store["crypto_ticker"].items():
            price = data.get("last") or data.get("lastPrice")
            if price is None:
                continue
            prev = last_prices.get(sym)
            if prev is not None:
                change = abs((price - prev) / prev) * 100
                if change >= threshold:
                    await httpx.AsyncClient().post(url, json={"type": "price_alert", "symbol": sym, "price": price, "change": change})
            last_prices[sym] = price
        # Check stock quotes (Alpaca)
        for sym, data in store["stock_quote"].items():
            price = data.get("ap") or data.get("price") or data.get("askprice") or data.get("bidprice")
            if price is None:
                continue
            prev = last_prices.get(sym)
            if prev is not None:
                change = abs((price - prev) / prev) * 100
                if change >= threshold:
                    await httpx.AsyncClient().post(url, json={"type": "price_alert", "symbol": sym, "price": price, "change": change})
            last_prices[sym] = price
        await asyncio.sleep(2)

# ---------------------------------------------------------------------
# Startup – launch all background coroutines
# ---------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    # Fire‑and‑forget tasks; they will keep running for the life of the app.
    asyncio.create_task(alpaca_stream())
    asyncio.create_task(ccxt_stream())
    asyncio.create_task(openbb_fetch())
    asyncio.create_task(price_alerts())

@app.on_event("shutdown")
async def shutdown_event():
    # No explicit cleanup – the process will exit.
    pass
