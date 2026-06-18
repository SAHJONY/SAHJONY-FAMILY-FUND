"use client";

import { useEffect, useState } from 'react';

export default function LiveData() {
  const [stockData, setStockData] = useState<Array<{symbol:string; price:number|null}>>([]);
  const [cryptoData, setCryptoData] = useState<Array<{symbol:string; price:number|null}>>([]);

  useEffect(() => {
    const stockSource = new EventSource('/api/live/stock');
    stockSource.onmessage = (e) => {
      try { setStockData(JSON.parse(e.data)); } catch {}
    };
    const cryptoSource = new EventSource('/api/live/crypto');
    cryptoSource.onmessage = (e) => {
      try { setCryptoData(JSON.parse(e.data)); } catch {}
    };
    return () => {
      stockSource.close();
      cryptoSource.close();
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">Live Stock Prices</h2>
      <ul>
        {stockData.map((s) => (
          <li key={s.symbol}>{s.symbol}: {s.price !== null ? s.price.toFixed(2) : '—'}</li>
        ))}
      </ul>
      <h2 className="text-lg font-bold">Live Crypto Prices</h2>
      <ul>
        {cryptoData.map((c) => (
          <li key={c.symbol}>{c.symbol}: {c.price !== null ? c.price.toFixed(2) : '—'}</li>
        ))}
      </ul>
    </div>
  );
}
