import { QueryHandler } from '../types/type';
import nlp from 'compromise';

// Enhanced Stock Quote Interface
interface StockQuote {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}
const COMPANY_TO_SYMBOL_MAP: Record<string, string> = {
  // Tech Companies
  'APPLE': 'AAPL',
  'MICROSOFT': 'MSFT',
  'GOOGLE': 'GOOGL',
  'ALPHABET': 'GOOGL',
  'AMAZON': 'AMZN',
  'TESLA': 'TSLA',
  'META': 'META',
  'FACEBOOK': 'META',
  'NETFLIX': 'NFLX',
  'NVIDIA': 'NVDA',
  'AMD': 'AMD',
  'INTEL': 'INTC',
  'IBM': 'IBM',
  'ORACLE': 'ORCL',
  'SALESFORCE': 'CRM',
  'ADOBE': 'ADBE',

  // Consumer Companies
  'WALMART': 'WMT',
  'DISNEY': 'DIS',
  'COCA COLA': 'KO',
  'COKE': 'KO',
  'MCDONALDS': 'MCD',
  'NIKE': 'NKE',
  'STARBUCKS': 'SBUX',
  'TARGET': 'TGT',
  'COSTCO': 'COST',

  // Financial Companies
  'JPMORGAN': 'JPM',
  'JP MORGAN': 'JPM',
  'GOLDMAN SACHS': 'GS',
  'BANK OF AMERICA': 'BAC',
  'VISA': 'V',
  'MASTERCARD': 'MA',
  'AMERICAN EXPRESS': 'AXP',

  // Other Major Companies
  'BOEING': 'BA',
  'GENERAL ELECTRIC': 'GE',
  'GE': 'GE',
  'FORD': 'F',
  'GENERAL MOTORS': 'GM',
  'GM': 'GM',
  'AT&T': 'T',
  'VERIZON': 'VZ',
  'EXXON': 'XOM',
  'EXXONMOBIL': 'XOM',
  'CHEVRON': 'CVX',
  'PFIZER': 'PFE',
  'JOHNSON & JOHNSON': 'JNJ',
  'JOHNSON AND JOHNSON': 'JNJ',
  'PROCTER & GAMBLE': 'PG',
  'P&G': 'PG',
    // Vietnamese Companies
    'VINGROUP': 'VIC',
    'VINHOMES': 'VHM',
    'VINCOM RETAIL': 'VRE',
    'VIETCOMBANK': 'VCB',
    'TECHCOMBANK': 'TCB',
    'VPBANK': 'VPB',
    'VINAMILK': 'VNM',
    'MASAN': 'MSN',
    'PV GAS': 'GAS',
    'HOA PHAT': 'HPG',
    'SABECO': 'SAB',
    'VIETJET': 'VJC',
    'FPT': 'FPT',
    'MOBIFONE': 'MBF',
    'PETROLIMEX': 'PLX',
    'VIETTEL': 'VTL',
    'VIETNAM AIRLINES': 'HVN',
    'BIDV': 'BID',
    'MB BANK': 'MBB',
    'ACB BANK': 'ACB',
    'VIETINBANK': 'CTG',
    'SACOMBANK': 'STB',
    'PV POWER': 'POW',
    'VIGLACERA': 'VGC',
    'NOVALAND': 'NVL',
    'VINACONEX': 'VCG',
    'VICOSTONE': 'VCS',
    'VNDIRECT': 'VND',
    'SSI': 'SSI',
    'PHAT DAT': 'PDR',
  
    // Common local names
    'VIETCOM BANK': 'VCB',
    'TECH COM BANK': 'TCB',
    'VP BANK': 'VPB',
    'VIET JET': 'VJC',
    'VIETNAM GAS': 'GAS',
    'PETRO VIETNAM GAS': 'GAS',
    'VIETNAM STEEL': 'HPG',
    'VIETNAM DAIRY': 'VNM',
    
    // Add abbreviated forms commonly used
    'VIC': 'VIC',
    'VHM': 'VHM',
    'VCB': 'VCB',
    'TCB': 'TCB',
    'VPB': 'VPB',
    'VNM': 'VNM',
    'MSN': 'MSN',
    'HPG': 'HPG',
};
// New interface for additional stock information
interface StockFundamentals {
  symbol: string;
  companyName: string;
  industry: string;
  marketCap: string;
  peRatio: string;
  dividendYield: string;
  eps: string;
  beta: string;
  fiftyDayMovingAverage: string;
  twoHundredDayMovingAverage: string;
}
interface ComprehensiveStockData {
    symbol: string;
    companyName: string;
    currentPrice: number;
    priceChange: number;
    percentChange: number;
    marketCap: number;
    peRatio: number;
    dividendYield: number;
    beta: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    volume: number;
    industry: string;
    performanceScore?: number;
  }
// Context storage for stock queries
let previousStockContext: {
  symbol?: string;
  quote?: StockQuote['Global Quote'];
  fundamentals?: StockFundamentals;
} = {};
// Top stocks across different sectors
const TOP_STOCKS = [
    // Technology
    { symbol: 'AAPL', sector: 'Technology' },
    { symbol: 'MSFT', sector: 'Technology' },
    { symbol: 'GOOGL', sector: 'Technology' },
    { symbol: 'NVDA', sector: 'Technology' },
    
    // Healthcare
    { symbol: 'JNJ', sector: 'Healthcare' },
    { symbol: 'PFE', sector: 'Healthcare' },
    
    // Financial
    { symbol: 'JPM', sector: 'Financial' },
    { symbol: 'BAC', sector: 'Financial' },
    
    // Consumer Discretionary
    { symbol: 'AMZN', sector: 'Consumer Discretionary' },
    { symbol: 'TSLA', sector: 'Consumer Discretionary' },
    
    // Communication Services
    { symbol: 'META', sector: 'Communication Services' },
    { symbol: 'NFLX', sector: 'Communication Services' }
  ];
async function fetchStockPrice(symbol: string): Promise<StockQuote | null> {
  try {
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    if (!API_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY not found in environment');
    }

    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch stock data');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Stock API error:', error);
    return null;
  }
}

async function fetchStockFundamentals(symbol: string): Promise<StockFundamentals | null> {
  try {
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    if (!API_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY not found in environment');
    }

    const response = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch stock fundamentals');
    }

    const data = await response.json();
    return {
      symbol: symbol,
      companyName: data.Name,
      industry: data.Industry,
      marketCap: data.MarketCapitalization,
      peRatio: data.PERatio,
      dividendYield: data.DividendYield,
      eps: data.EPS,
      beta: data.Beta,
      fiftyDayMovingAverage: data.FiftyDayMovingAverage,
      twoHundredDayMovingAverage: data.TwoHundredDayMovingAverage
    };
  } catch (error) {
    console.error('Stock fundamentals API error:', error);
    return null;
  }
}

function formatStockResponse(quote: StockQuote['Global Quote'], fundamentals: StockFundamentals | null, symbol: string): string {
  const price = parseFloat(quote['05. price']).toFixed(2);
  const change = parseFloat(quote['09. change']).toFixed(2);
  const changePercent = quote['10. change percent'];
  const volume = parseInt(quote['06. volume']).toLocaleString();
  const tradingDay = new Date(quote['07. latest trading day']).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const changeSymbol = parseFloat(change) >= 0 ? '↑' : '↓';
  const changeColor = parseFloat(change) >= 0 ? 'green' : 'red';

  let fundamentalsInfo = '';
  if (fundamentals) {
    fundamentalsInfo = `\n\nCompany Details:
Company Name: ${fundamentals.companyName}
Industry: ${fundamentals.industry}
Market Cap: $${(parseInt(fundamentals.marketCap) / 1_000_000).toFixed(2)} million
P/E Ratio: ${fundamentals.peRatio}
Dividend Yield: ${(parseFloat(fundamentals.dividendYield) * 100).toFixed(2)}%
Earnings Per Share (EPS): $${fundamentals.eps}
Beta: ${fundamentals.beta}
50-Day Moving Average: $${fundamentals.fiftyDayMovingAverage}
200-Day Moving Average: $${fundamentals.twoHundredDayMovingAverage}`;
  }

  return `Stock Information for ${symbol}\n` +
         `Last Trading Day: ${tradingDay}\n\n` +
         `Current Price: $${price}\n` +
         `Change: ${changeSymbol} $${Math.abs(parseFloat(change)).toFixed(2)} (${changePercent})\n` +
         `Trading Volume: ${volume}\n` +
         `Day Range: $${parseFloat(quote['03. high']).toFixed(2)} - $${parseFloat(quote['04. low']).toFixed(2)}\n` +
         `Opening Price: $${parseFloat(quote['02. open']).toFixed(2)}\n` +
         `Previous Close: $${parseFloat(quote['08. previous close']).toFixed(2)}` +
         fundamentalsInfo;
}

const STOCK_RELATED_TERMS = [
  'stock', 'share', 'price', 'market', 'trading', 'investment',
  'company', 'corporation', 'ticker', 'symbol', 'securities',
  'equity', 'exchange', 'nasdaq', 'nyse', 'dow', 'sp500', 's&p',
  'co phieu', 'chung khoan', 'san giao dich',
  'gia', 'thi truong', 'hose', 'hnx', 'upcom',
  'von hoa', 'thi gia', 'bien do'
];

function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[&]/g, ' AND ')
    .replace(/[^A-Z0-9\s]/g, '')  // Remove special characters but keep spaces
    .replace(/\s+/g, ' ')         // Normalize spaces
    .replace(/CORP$/, '')         // Remove common suffixes
    .replace(/GROUP$/, '')
    .replace(/JSC$/, '')
    .replace(/JOINT STOCK$/, '')
    .trim();
}

// Add this function to handle context reset
function clearPreviousStockContext() {
  previousStockContext = {
    symbol: undefined,
    quote: undefined,
    fundamentals: undefined
  };
}

function extractStockSymbol(question: string): string | null {
  console.log('Extracting stock symbol from question:', question);

  // Use compromise for NLP analysis
  const doc = nlp(question);
  
  // Extract organizations and nouns
  let organizations = doc.organizations().out('array');
  let nouns = doc.nouns().out('array');
  console.log('Detected organizations:', organizations);
  console.log('Detected nouns:', nouns);

  // First try to find a new company/stock mention
  const potentialCompanies = [...organizations, ...nouns];
  for (const company of potentialCompanies) {
    const normalizedName = normalizeCompanyName(company);
    if (COMPANY_TO_SYMBOL_MAP[normalizedName]) {
      console.log('Found new company name match:', normalizedName);
      // Clear previous context when new company is found
      clearPreviousStockContext();
      return COMPANY_TO_SYMBOL_MAP[normalizedName];
    }
  }

  // Direct symbol check
  const symbolPattern = /\b[A-Z]{1,5}\b/g;
  const directSymbols = question.match(symbolPattern) || [];
  for (const symbol of directSymbols) {
    if (Object.values(COMPANY_TO_SYMBOL_MAP).includes(symbol)) {
      console.log('Found direct stock symbol:', symbol);
      clearPreviousStockContext();
      return symbol;
    }
  }

  // Word by word check
  const words = question.split(/\s+/);
  for (const word of words) {
    const normalizedWord = normalizeCompanyName(word);
    if (COMPANY_TO_SYMBOL_MAP[normalizedWord]) {
      console.log('Found company name in word:', normalizedWord);
      clearPreviousStockContext();
      return COMPANY_TO_SYMBOL_MAP[normalizedWord];
    }
  }

  // Only check context if no new company is mentioned
  const contextPatterns = [
    /(?:it|this stock|that stock)/i,
    /promising|compare|performance/i,
    /(?:best|top|current|market)\s+(?:stocks?|performing)/i
  ];

  const isContextQuestion = contextPatterns.some(pattern => pattern.test(question));
  
  if (isContextQuestion && previousStockContext.symbol) {
    console.log('Using previous stock context:', previousStockContext.symbol);
    return previousStockContext.symbol;
  }

  console.log('No stock symbol found');
  return null;
}
export const stockHandler: QueryHandler = {
  name: 'Stock Market',
  description: 'Get real-time stock market information and prices, including comparative analysis',
  patterns: [
    /stock.*(?:price|value).*(?:of|for)\s+([A-Za-z\s.]+)(?:\?)?$/i,
    /how.*(?:is|are)\s+([A-Za-z\s.]+)\s+stock.*(?:doing|performing)(?:\?)?$/i,
    /what.*(?:is|are).*([A-Za-z\s.]+)\s+stock.*(?:price|value)(?:\?)?$/i,
    /show.*([A-Za-z\s.]+)\s+stock.*(?:price|value)(?:\?)?$/i,
    // Promising/comparison patterns
    /(?:is|looks?)\s+(?:it|this stock)\s+promising/i,
    /how.*(?:promising|perform(?:ing)?)\s+is\s+(?:it|this stock)/i,
    /what.*(?:is|are)\s+(?:the\s+)?(?:current\s+)?(?:best|top|promising)\s+(?:stocks?|market)/i,
    /how.*(?:is|are)\s+(?:the\s+)?stock\s+market\s+(?:doing|performing)/i,
    /(?:give\s+me|show)\s+(?:the\s+)?stock\s+market\s+overview/i,
    /which\s+stocks?\s+(?:are\s+)?(?:promising|performing\s+well)/i,
    /compare\s+(?:current\s+)?stock\s+performance/i
  ],
  handle: async (question: string): Promise<string | null> => {
  // Check for market overview queries
  const marketOverviewPatterns = [
    /what.*(?:is|are)\s+(?:the\s+)?(?:current\s+)?(?:best|top|promising)\s+(?:stocks?|market)/i,
    /how.*(?:is|are)\s+(?:the\s+)?stock\s+market\s+(?:doing|performing)/i,
    /(?:give\s+me|show)\s+(?:the\s+)?stock\s+market\s+overview/i,
    /which\s+stocks?\s+(?:are\s+)?(?:promising|performing\s+well)/i,
    /compare\s+(?:current\s+)?stock\s+performance/i
  ];

  const isMarketOverviewQuery = marketOverviewPatterns.some(pattern => pattern.test(question));

  if (isMarketOverviewQuery) {
    try {
      const comprehensiveStockData = await fetchComprehensiveStockData();

      if (!comprehensiveStockData || comprehensiveStockData.length === 0) {
        return "Sorry, I couldn't retrieve current stock market information at the moment.";
      }

      return formatStockMarketOverview(comprehensiveStockData);
    } catch (error) {
      console.error('Market overview fetch error:', error);
      return "Sorry, I encountered an error while trying to fetch stock market information.";
    }
    }

    console.log('Stock handler received question:', question);
    const symbol = extractStockSymbol(question);
    
    console.log('Extracted stock symbol:', symbol);
    
    if (!symbol) {
      console.log('No valid stock symbol found');
      return null;
    }

    try {
      console.log(`Fetching stock data for symbol: ${symbol}`);
      const [stockData, fundamentalsData] = await Promise.all([
        fetchStockPrice(symbol),
        fetchStockFundamentals(symbol)
      ]);

      console.log('Received stock data:', JSON.stringify(stockData, null, 2));
      console.log('Received fundamentals data:', JSON.stringify(fundamentalsData, null, 2));

      if (!stockData || !stockData['Global Quote'] || Object.keys(stockData['Global Quote']).length === 0) {
        console.log(`No stock data found for symbol: ${symbol}`);
        return `Sorry, I couldn't find stock information for ${symbol}. Please check if the symbol is correct.`;
      }

      // Store context for potential follow-up questions
      previousStockContext = {
        symbol: symbol,
        quote: stockData['Global Quote'],
        fundamentals: fundamentalsData
      };

      // Comparative analysis and promise assessment
      let promiseAssessment = '';
      if (fundamentalsData) {
        const marketCapInMillions = parseInt(fundamentalsData.marketCap) / 1_000_000;
        const peRatio = parseFloat(fundamentalsData.peRatio);
        const dividendYield = parseFloat(fundamentalsData.dividendYield) * 100;
        const beta = parseFloat(fundamentalsData.beta);
        const priceChange = parseFloat(stockData['Global Quote']['09. change']);
        const changePercent = parseFloat(stockData['Global Quote']['10. change percent']);

        // Comprehensive promise assessment
        promiseAssessment = `\n\nInvestment Potential Assessment:\n`;

        // Market Position
        if (marketCapInMillions > 10000) {
          promiseAssessment += `• Market Leadership: Strong (Large Cap, ${marketCapInMillions.toFixed(2)} million market cap)\n`;
        } else if (marketCapInMillions > 2000) {
          promiseAssessment += `• Market Position: Solid (Mid Cap, ${marketCapInMillions.toFixed(2)} million market cap)\n`;
        }

        // Valuation
        if (peRatio < 15) {
          promiseAssessment += `• Valuation: Potentially Undervalued (P/E Ratio: ${peRatio.toFixed(2)})\n`;
        } else if (peRatio > 25) {
          promiseAssessment += `• Valuation: Trading at a premium (P/E Ratio: ${peRatio.toFixed(2)})\n`;
        } else {
          promiseAssessment += `• Valuation: Fairly priced (P/E Ratio: ${peRatio.toFixed(2)})\n`;
        }

        // Recent Performance
        if (priceChange > 0) {
          promiseAssessment += `• Recent Performance: Positive (${changePercent}% change)\n`;
        } else {
          promiseAssessment += `• Recent Performance: Negative (${changePercent}% change)\n`;
        }

        // Dividend and Stability
        if (dividendYield > 3) {
          promiseAssessment += `• Income Potential: High dividend yield (${dividendYield.toFixed(2)}%)\n`;
        } else if (dividendYield > 1) {
          promiseAssessment += `• Income Potential: Moderate dividend (${dividendYield.toFixed(2)}%)\n`;
        }

        // Volatility
        if (beta < 0.5) {
          promiseAssessment += `• Market Risk: Low volatility (Beta: ${beta.toFixed(2)})\n`;
        } else if (beta < 1) {
          promiseAssessment += `• Market Risk: Moderate volatility (Beta: ${beta.toFixed(2)})\n`;
        } else {
          promiseAssessment += `• Market Risk: High volatility (Beta: ${beta.toFixed(2)})\n`;
        }

        // Overall Promise Assessment
        promiseAssessment += `\nOverall Promise: ${
          (peRatio < 20 && marketCapInMillions > 2000 && priceChange > 0 && dividendYield > 1)
            ? 'Highly Promising' 
            : (peRatio < 25 && marketCapInMillions > 1000 && dividendYield > 0.5)
            ? 'Moderately Promising'
            : 'Requires Careful Consideration'
        }`;
      }

      return formatStockResponse(stockData['Global Quote'], fundamentalsData, symbol) + promiseAssessment;
    } catch (error) {
      console.error('Stock handler error:', error);
      return `An error occurred while fetching stock information for ${symbol}.`;
    }
  }
};

// Fetch comprehensive stock data for market overview
async function fetchComprehensiveStockData(): Promise<ComprehensiveStockData[]> {
    try {
      const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
      if (!API_KEY) {
        throw new Error('ALPHA_VANTAGE_API_KEY not found in environment');
      }
  
      // Fetch data for top stocks with comprehensive details
      const stockDataPromises = TOP_STOCKS.map(async (stock) => {
        // Fetch Global Quote (current price and changes)
        const quoteResponse = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.symbol}&apikey=${API_KEY}`
        );
        const quoteData = await quoteResponse.json();
  
        // Fetch Fundamentals Overview
        const overviewResponse = await fetch(
          `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${stock.symbol}&apikey=${API_KEY}`
        );
        const overviewData = await overviewResponse.json();
  
        // If either fetch fails, return null
        if (!quoteData['Global Quote'] || !overviewData) {
          return null;
        }
  
        // Calculate performance score (custom algorithm)
        const currentPrice = parseFloat(quoteData['Global Quote']['05. price']);
        const priceChange = parseFloat(quoteData['Global Quote']['09. change']);
        const percentChange = parseFloat(quoteData['Global Quote']['10. change percent']);
        
        // Performance scoring algorithm
        const performanceScore = calculatePerformanceScore({
          priceChange,
          percentChange,
          peRatio: parseFloat(overviewData.PERatio),
          dividendYield: parseFloat(overviewData.DividendYield),
          marketCap: parseInt(overviewData.MarketCapitalization)
        });
  
        return {
          symbol: stock.symbol,
          companyName: overviewData.Name,
          currentPrice: currentPrice,
          priceChange: priceChange,
          percentChange: percentChange,
          marketCap: parseInt(overviewData.MarketCapitalization),
          peRatio: parseFloat(overviewData.PERatio),
          dividendYield: parseFloat(overviewData.DividendYield) * 100,
          beta: parseFloat(overviewData.Beta),
          fiftyTwoWeekHigh: parseFloat(overviewData['52WeekHigh']),
          fiftyTwoWeekLow: parseFloat(overviewData['52WeekLow']),
          volume: parseInt(quoteData['Global Quote']['06. volume']),
          industry: overviewData.Industry,
          performanceScore: performanceScore
        } as ComprehensiveStockData;
      });
  
      // Wait for all promises and filter out null results
      const stockData = await Promise.all(stockDataPromises);
      return stockData.filter((stock): stock is ComprehensiveStockData => stock !== null);
    } catch (error) {
      console.error('Comprehensive stock data fetch error:', error);
      return [];
    }
  }
// Performance scoring algorithm
function calculatePerformanceScore(metrics: {
    priceChange: number, 
    percentChange: number, 
    peRatio: number, 
    dividendYield: number,
    marketCap: number
  }): number {
    let score = 50; // Base score
  
    // Price change impact
    score += metrics.percentChange > 0 ? 10 : -5;
  
    // P/E Ratio impact (lower is generally better)
    if (metrics.peRatio < 15) score += 10;
    else if (metrics.peRatio > 30) score -= 5;
  
    // Dividend yield impact
    if (metrics.dividendYield > 3) score += 5;
    else if (metrics.dividendYield > 1) score += 2;
  
    // Market cap stability
    if (metrics.marketCap > 100_000_000_000) score += 10;
  
    // Normalize score
    return Math.max(0, Math.min(100, score));
  }
// Format market overview
function formatStockMarketOverview(stocks: ComprehensiveStockData[]): string {
    // Sort stocks by performance score in descending order
    const sortedStocks = stocks.sort((a, b) => 
      (b.performanceScore || 0) - (a.performanceScore || 0)
    );
  
    let overviewText = "Stock Market Overview:\n\n";
  
    // Top 5 Performers
    overviewText += "Top 5 Performing Stocks:\n";
    sortedStocks.slice(0, 5).forEach((stock, index) => {
      overviewText += `${index + 1}. ${stock.companyName} (${stock.symbol})\n` +
        `   Price: $${stock.currentPrice.toFixed(2)} ` +
        `(${stock.priceChange >= 0 ? '↑' : '↓'} ${Math.abs(stock.priceChange).toFixed(2)}, ${stock.percentChange}%)\n` +
        `   Performance Score: ${stock.performanceScore?.toFixed(2)}/100\n` +
        `   Sector: ${stock.industry}\n\n`;
    });
  
    // Sector Performance Summary
    const sectorPerformance = groupBySector(sortedStocks);
    overviewText += "Sector Performance Summary:\n";
    Object.entries(sectorPerformance).forEach(([sector, stocks]) => {
      const avgPerformanceScore = stocks.reduce((sum, stock) => sum + (stock.performanceScore || 0), 0) / stocks.length;
      overviewText += `${sector}: Average Performance Score ${avgPerformanceScore.toFixed(2)}/100\n`;
    });
  
    overviewText += "\nNote: Performance scores are based on price change, valuation, dividend yield, and market capitalization.";
    return overviewText;
  }
  
  // Group stocks by sector
  function groupBySector(stocks: ComprehensiveStockData[]): Record<string, ComprehensiveStockData[]> {
    return stocks.reduce((acc, stock) => {
      const sector = stock.industry || 'Unknown';
      if (!acc[sector]) {
        acc[sector] = [];
      }
      acc[sector].push(stock);
      return acc;
    }, {} as Record<string, ComprehensiveStockData[]>);
  }
  