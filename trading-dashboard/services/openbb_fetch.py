"""Fetch news, fundamentals, and economic data using OpenBB.
This script can be scheduled (cron) or called from the dashboard API.
"""

from openbb import openbb

# Example: fetch S&P 500 news
news = openbb.news.search("S&P 500", limit=10)
print(news)

# Example: fetch fundamentals for a ticker
fundamentals = openbb.equity.fundamentals("AAPL")
print(fundamentals)

# Example: fetch economic indicator
cpi = openbb.economics.cpi()
print(cpi)
