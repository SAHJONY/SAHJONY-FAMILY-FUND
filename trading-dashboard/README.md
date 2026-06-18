# Trading Dashboard (Family Fund)

This repository contains an autonomous AI‑enabled trading dashboard built on the stack you requested:

- **OpenBB** – News, fundamentals, economic data (Python).
- **CCXT** – Real‑time crypto market data via WebSocket (Python).
- **Alpaca** – Real‑time stock market data and paper‑trading (Python).
- **FastAPI** – Backend exposing data endpoints.
- **Next.js (App Router)** – Front‑end dashboard UI (React/TypeScript).
- **PostgreSQL + Redis** – Suggested data layer (not provisioned yet).

## Folder layout
```
trading-dashboard/
├─ app/                # Next.js app (React UI)
├─ services/          # Python services & FastAPI server
│   ├─ openbb_fetch.py
│   ├─ ccxt_ws.py
│   ├─ alpaca_ws.py
│   ├─ api.py        # FastAPI entry point
│   └─ requirements.txt
├─ .gitignore
└─ README.md
```

## Getting started
1. **Install backend dependencies**
   ```bash
   cd services
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Run the FastAPI server**
   ```bash
   uvicorn api:app --reload --port 8000
   ```
   The API will be reachable at `http://localhost:8000`.

3. **Run the Next.js front‑end**
   ```bash
   cd ../
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Configure credentials**
   - Set `ALPACA_API_KEY` and `ALPACA_API_SECRET` in your environment for Alpaca.
   - OpenBB uses its own config (see OpenBB docs).

## Next steps (you may implement)
- Connect the FastAPI background tasks to continuously fetch data from OpenBB, CCXT, and Alpaca and store it in PostgreSQL.
- Add TradingView webhook endpoint to `services/api.py`.
- Implement Redis caching for low‑latency price feeds.
- Extend the Next.js UI to display live tickers, news, and AI‑generated signals.
- Deploy to Vercel (frontend) and a suitable Python host (e.g., Fly.io, Render).

## License
MIT – feel free to adapt and extend.
