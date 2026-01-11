/**
 * Portfolio Tracker - Main Application
 * Fetches live stock prices and calculates portfolio performance
 */

// CORS proxy for Yahoo Finance API (needed for browser requests)
const CORS_PROXY = 'https://corsproxy.io/?';

// Exchange rate tickers for Yahoo Finance
const EXCHANGE_RATE_TICKERS = {
    GBP: 'GBPEUR=X',
    USD: 'USDEUR=X',
    SEK: 'SEKEUR=X',
    PLN: 'PLNEUR=X'
};

// State
let transactions = [];
let exchangeRates = {};
let stockPrices = {};

/**
 * Format number as currency (EUR)
 */
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Format number with thousands separator
 */
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

/**
 * Format percentage
 */
function formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return sign + formatNumber(value, 2) + '%';
}

/**
 * Fetch stock price from Yahoo Finance via CORS proxy
 */
async function fetchYahooPrice(ticker) {
    try {
        const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
            return data.chart.result[0].meta.regularMarketPrice;
        }

        throw new Error('No price data');
    } catch (error) {
        console.error(`Failed to fetch ${ticker}:`, error.message);
        return null;
    }
}

/**
 * Fetch all exchange rates
 */
async function fetchExchangeRates() {
    const rates = { EUR: 1 }; // EUR to EUR is always 1

    const promises = Object.entries(EXCHANGE_RATE_TICKERS).map(async ([currency, ticker]) => {
        const rate = await fetchYahooPrice(ticker);
        if (rate) {
            rates[currency] = rate;
        } else {
            // Fallback rates if fetch fails
            const fallbacks = { GBP: 1.17, USD: 0.92, SEK: 0.088, PLN: 0.23 };
            rates[currency] = fallbacks[currency] || 1;
            console.warn(`Using fallback rate for ${currency}: ${rates[currency]}`);
        }
    });

    await Promise.all(promises);
    return rates;
}

/**
 * Convert local currency price to EUR
 */
function convertToEUR(price, localCurrency, rates) {
    if (price === null || price === undefined) return null;

    // Handle GBX (pence) - divide by 100 to get GBP, then convert
    if (localCurrency === 'GBX') {
        return (price / 100) * (rates.GBP || 1.17);
    }

    // Handle other currencies
    const currency = localCurrency.toUpperCase();
    if (currency === 'EUR') return price;

    const rate = rates[currency];
    if (rate) {
        return price * rate;
    }

    console.warn(`No exchange rate for ${currency}, returning original price`);
    return price;
}

/**
 * Determine local currency from ticker
 */
function getCurrencyFromTicker(ticker) {
    if (ticker.endsWith('.L')) return 'GBX';
    if (ticker.endsWith('.AS')) return 'EUR';
    if (ticker.endsWith('.DE')) return 'EUR';
    if (ticker.endsWith('.ST')) return 'SEK';
    if (ticker.endsWith('.WA')) return 'PLN';
    return 'USD'; // Default for US stocks (NYSE, NASDAQ)
}

/**
 * Load transactions from JSON file
 */
async function loadTransactions() {
    try {
        const response = await fetch('data/transactions.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.transactions || [];
    } catch (error) {
        console.error('Failed to load transactions:', error);
        throw error;
    }
}

/**
 * Calculate positions from transactions
 */
function calculatePositions(transactions) {
    const positionsByTicker = {};

    transactions.forEach(tx => {
        const ticker = tx.yahooTicker;

        if (!positionsByTicker[ticker]) {
            positionsByTicker[ticker] = {
                ticker: ticker,
                name: tx.name,
                localCurrency: tx.localCurrency,
                buys: [],
                sells: [],
                currentQuantity: 0
            };
        }

        const position = positionsByTicker[ticker];

        if (tx.type === 'buy') {
            position.buys.push({
                quantity: tx.quantity,
                pricePerShare: tx.pricePerShare,
                localCurrency: tx.localCurrency,
                eurValue: tx.eurValue,
                totalCosts: tx.totalCosts || 0,
                totalEur: tx.totalEur
            });
            position.currentQuantity += tx.quantity;
        } else if (tx.type === 'sell') {
            position.sells.push({
                quantity: tx.quantity,
                pricePerShare: tx.pricePerShare,
                localCurrency: tx.localCurrency,
                eurValue: tx.eurValue,
                totalCosts: tx.totalCosts || 0,
                totalEur: tx.totalEur
            });
            position.currentQuantity -= tx.quantity;
        }
    });

    return positionsByTicker;
}

/**
 * Calculate average purchase price for buys (in EUR, including costs)
 */
function calculateAvgBuyPrice(buys) {
    if (buys.length === 0) return 0;

    let totalCost = 0;
    let totalQuantity = 0;

    buys.forEach(buy => {
        // Use totalEur which includes transaction costs
        totalCost += buy.totalEur;
        totalQuantity += buy.quantity;
    });

    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
}

/**
 * Calculate average sell price (in EUR)
 */
function calculateAvgSellPrice(sells) {
    if (sells.length === 0) return 0;

    let totalValue = 0;
    let totalQuantity = 0;

    sells.forEach(sell => {
        // For sells, eurValue is what we received (before costs)
        totalValue += sell.eurValue;
        totalQuantity += sell.quantity;
    });

    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
}

/**
 * Calculate total transaction costs
 */
function calculateTotalCosts(buys, sells) {
    let total = 0;
    buys.forEach(b => total += b.totalCosts || 0);
    sells.forEach(s => total += s.totalCosts || 0);
    return total;
}

/**
 * Main initialization
 */
async function init() {
    const loadingOverlay = document.getElementById('loadingOverlay');

    try {
        // Load transactions
        transactions = await loadTransactions();

        if (transactions.length === 0) {
            throw new Error('No transactions found');
        }

        // Calculate positions
        const positions = calculatePositions(transactions);

        // Get unique tickers
        const tickers = [...new Set(transactions.map(t => t.yahooTicker))];

        // Fetch exchange rates and stock prices in parallel
        const [rates, ...prices] = await Promise.all([
            fetchExchangeRates(),
            ...tickers.map(ticker => fetchYahooPrice(ticker))
        ]);

        exchangeRates = rates;

        // Map prices to tickers
        tickers.forEach((ticker, i) => {
            stockPrices[ticker] = prices[i];
        });

        // Separate open and closed positions
        const openPositions = [];
        const closedPositions = [];

        Object.values(positions).forEach(pos => {
            if (pos.currentQuantity > 0) {
                openPositions.push(pos);
            } else if (pos.sells.length > 0) {
                closedPositions.push(pos);
            }
        });

        // Calculate metrics for open positions
        let totalPortfolioValue = 0;
        let totalInvested = 0;
        let totalUnrealizedPL = 0;

        const openData = openPositions.map(pos => {
            const avgBuyPrice = calculateAvgBuyPrice(pos.buys);
            const localCurrency = getCurrencyFromTicker(pos.ticker);
            const currentLocalPrice = stockPrices[pos.ticker];
            const currentPriceEUR = convertToEUR(currentLocalPrice, localCurrency, exchangeRates);

            const invested = avgBuyPrice * pos.currentQuantity;
            const currentValue = currentPriceEUR !== null ? currentPriceEUR * pos.currentQuantity : null;
            const pl = currentValue !== null ? currentValue - invested : null;
            const plPercent = pl !== null && invested > 0 ? (pl / invested) * 100 : null;

            if (currentValue !== null) {
                totalPortfolioValue += currentValue;
            }
            totalInvested += invested;
            if (pl !== null) {
                totalUnrealizedPL += pl;
            }

            return {
                ticker: pos.ticker,
                name: pos.name,
                quantity: pos.currentQuantity,
                avgBuyPrice,
                currentPriceEUR,
                currentValue,
                pl,
                plPercent
            };
        });

        // Calculate portfolio percentage
        openData.forEach(d => {
            d.portfolioPercent = d.currentValue !== null && totalPortfolioValue > 0
                ? (d.currentValue / totalPortfolioValue) * 100
                : null;
        });

        // Calculate metrics for closed positions
        let totalRealizedPL = 0;

        const closedData = closedPositions.map(pos => {
            const avgBuyPrice = calculateAvgBuyPrice(pos.buys);
            const avgSellPrice = calculateAvgSellPrice(pos.sells);
            const totalQtySold = pos.sells.reduce((sum, s) => sum + s.quantity, 0);
            const totalCosts = calculateTotalCosts(pos.buys, pos.sells);

            // Realized P/L = (avgSellPrice - avgBuyPrice) * qtySold - additional costs from sells
            const sellCosts = pos.sells.reduce((sum, s) => sum + (s.totalCosts || 0), 0);
            const realizedPL = (avgSellPrice - avgBuyPrice) * totalQtySold - sellCosts;

            totalRealizedPL += realizedPL;

            return {
                ticker: pos.ticker,
                name: pos.name,
                quantityTraded: totalQtySold,
                avgBuyPrice,
                avgSellPrice,
                totalCosts,
                realizedPL
            };
        });

        // Render tables
        renderOpenPositions(openData);
        renderClosedPositions(closedData);

        // Update summary
        updateSummary({
            totalPortfolioValue,
            totalInvested,
            totalUnrealizedPL,
            totalRealizedPL
        });

        // Update timestamp
        document.getElementById('lastUpdated').textContent =
            `Last updated: ${new Date().toLocaleString('en-GB')}`;

    } catch (error) {
        console.error('Initialization failed:', error);
        document.getElementById('openPositionsBody').innerHTML =
            `<tr><td colspan="9" class="error-cell">Error loading data: ${error.message}</td></tr>`;
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * Update summary cards
 */
function updateSummary({ totalPortfolioValue, totalInvested, totalUnrealizedPL, totalRealizedPL }) {
    const totalPL = totalUnrealizedPL + totalRealizedPL;
    const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    // Total Portfolio Value
    document.getElementById('totalValue').textContent = formatCurrency(totalPortfolioValue);

    // Total Invested
    document.getElementById('totalInvested').textContent = formatCurrency(totalInvested);

    // Total P/L
    const totalPLEl = document.getElementById('totalPL');
    totalPLEl.textContent = formatCurrency(totalPL);
    totalPLEl.className = 'summary-value ' + (totalPL >= 0 ? 'profit' : 'loss');

    const totalPLPercentEl = document.getElementById('totalPLPercent');
    totalPLPercentEl.textContent = formatPercent(totalPLPercent);
    totalPLPercentEl.className = 'summary-percent ' + (totalPLPercent >= 0 ? 'profit' : 'loss');

    // Unrealized P/L
    const unrealizedEl = document.getElementById('unrealizedPL');
    unrealizedEl.textContent = formatCurrency(totalUnrealizedPL);
    unrealizedEl.className = 'summary-value ' + (totalUnrealizedPL >= 0 ? 'profit' : 'loss');

    // Realized P/L
    const realizedEl = document.getElementById('realizedPL');
    realizedEl.textContent = formatCurrency(totalRealizedPL);
    realizedEl.className = 'summary-value ' + (totalRealizedPL >= 0 ? 'profit' : 'loss');
}

/**
 * Render open positions table
 */
function renderOpenPositions(data) {
    const tbody = document.getElementById('openPositionsBody');

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No open positions</td></tr>';
        return;
    }

    // Sort by current value descending
    data.sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

    tbody.innerHTML = data.map(pos => {
        const plClass = pos.pl !== null ? (pos.pl >= 0 ? 'profit' : 'loss') : '';

        return `
            <tr>
                <td class="ticker">${pos.ticker}</td>
                <td class="name">${pos.name}</td>
                <td class="text-right number">${formatNumber(pos.quantity, 0)}</td>
                <td class="text-right number">${formatCurrency(pos.avgBuyPrice)}</td>
                <td class="text-right number">${formatCurrency(pos.currentPriceEUR)}</td>
                <td class="text-right number">${formatCurrency(pos.currentValue)}</td>
                <td class="text-right number ${plClass}">${formatCurrency(pos.pl)}</td>
                <td class="text-right number ${plClass}">${formatPercent(pos.plPercent)}</td>
                <td class="text-right number">${formatPercent(pos.portfolioPercent)}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Render closed positions table
 */
function renderClosedPositions(data) {
    const tbody = document.getElementById('closedPositionsBody');

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No closed positions</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(pos => {
        const plClass = pos.realizedPL >= 0 ? 'profit' : 'loss';

        return `
            <tr>
                <td class="ticker">${pos.ticker}</td>
                <td class="name">${pos.name}</td>
                <td class="text-right number">${formatNumber(pos.quantityTraded, 0)}</td>
                <td class="text-right number">${formatCurrency(pos.avgBuyPrice)}</td>
                <td class="text-right number">${formatCurrency(pos.avgSellPrice)}</td>
                <td class="text-right number">${formatCurrency(pos.totalCosts)}</td>
                <td class="text-right number ${plClass}">${formatCurrency(pos.realizedPL)}</td>
            </tr>
        `;
    }).join('');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
