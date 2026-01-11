# Portfolio Tracker

A static stock portfolio tracker that displays your holdings with live prices from Yahoo Finance. Designed for GitHub Pages hosting.

## Features

- Live stock prices from Yahoo Finance
- Multi-currency support (EUR, USD, GBP/GBX, SEK, PLN)
- Automatic currency conversion to EUR
- Open and closed position tracking
- Profit/Loss calculations (realized & unrealized)
- Clean dark-mode dashboard
- No backend required - runs entirely in browser

## Quick Start

1. Clone or download this repository
2. Edit `data/transactions.json` with your transactions
3. Open `index.html` in a browser (or deploy to GitHub Pages)

## Adding Transactions

Edit `data/transactions.json` to add your transactions. Each transaction needs:

```json
{
  "orderId": "unique-id",
  "date": "2024-12-08T11:45:40",
  "name": "Company Name",
  "isin": "ISIN code",
  "yahooTicker": "TICKER.EXCHANGE",
  "type": "buy",
  "orderType": "Limit Order",
  "exchange": "Exchange Name",
  "venue": "Venue Code",
  "quantity": 10,
  "pricePerShare": 100.00,
  "localCurrency": "EUR",
  "localValue": 1000.00,
  "eurValue": 1000.00,
  "exchangeRate": 1,
  "autoFxCosts": 0,
  "transactionCosts": 2.00,
  "stampDuty": 0,
  "totalCosts": 2.00,
  "totalEur": 1002.00
}
```

### Transaction Types

- `"type": "buy"` - Purchase transaction (adds to position)
- `"type": "sell"` - Sale transaction (reduces position)

### Yahoo Finance Tickers

Common ticker formats:
- US stocks: `AMZN`, `TSM`, `UBER` (no suffix)
- London: `III.L`, `WISE.L` (prices in GBX/pence)
- Amsterdam: `UMG.AS`, `VUSA.AS`
- Frankfurt: `CHG.DE`
- Stockholm: `EVO.ST`, `ROKO-B.ST`
- Warsaw: `DNP.WA`

## Deploy to GitHub Pages

### Method 1: GitHub Web Interface

1. Create a new repository on GitHub
2. Upload all files to the repository
3. Go to Settings → Pages
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch and "/ (root)" folder
6. Click Save
7. Your site will be available at `https://yourusername.github.io/repository-name`

### Method 2: Command Line

```bash
# Navigate to project folder
cd PortfolioTracker

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial portfolio tracker setup"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main

# Then enable GitHub Pages in repository Settings → Pages
```

## Local Development

Simply open `index.html` in a modern web browser. No server required.

For live reload during development, you can use:
```bash
# Python 3
python -m http.server 8000

# Then open http://localhost:8000
```

## Currency Handling

The tracker automatically handles currency conversion:

| Exchange | Currency | Conversion |
|----------|----------|------------|
| NYSE/NASDAQ | USD | × USDEUR rate |
| LSE (.L) | GBX (pence) | ÷ 100 × GBPEUR rate |
| Euronext (.AS) | EUR | No conversion |
| XETRA (.DE) | EUR | No conversion |
| Stockholm (.ST) | SEK | × SEKEUR rate |
| Warsaw (.WA) | PLN | × PLNEUR rate |

## Troubleshooting

### Prices not loading
- Check browser console for errors
- Yahoo Finance API may have rate limits
- Try refreshing the page

### CORS errors
The app uses a CORS proxy (`corsproxy.io`). If it's down, you can change it in `js/app.js`:
```javascript
const CORS_PROXY = 'https://corsproxy.io/?';
// Alternative: 'https://api.allorigins.win/raw?url='
```

## File Structure

```
portfolio-tracker/
├── index.html          # Main webpage
├── css/
│   └── style.css       # Dark theme styling
├── js/
│   └── app.js          # Application logic
├── data/
│   └── transactions.json   # Your transaction data
└── README.md
```

## License

MIT - Use freely for personal portfolio tracking.
