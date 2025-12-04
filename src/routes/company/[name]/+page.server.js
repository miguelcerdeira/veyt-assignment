import { FMP_API_KEY } from '$env/static/private';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const term = params.name;
  const apiKey = FMP_API_KEY;
  const FMP_BASE = 'https://financialmodelingprep.com/stable';

  if (!apiKey) {
    throw new Error('FMP_API_KEY environment variable is not set');
  }

  /**
   * Common company name to symbol mappings as fallback
   * This helps when search endpoints are not available
   * @type {Record<string, string>}
   */
  const commonCompanyMappings = {
    'microsoft': 'MSFT',
    'apple': 'AAPL',
    'amazon': 'AMZN',
    'alphabet': 'GOOGL',
    'google': 'GOOGL',
    'meta': 'META',
    'facebook': 'META',
    'tesla': 'TSLA',
    'nvidia': 'NVDA',
    'netflix': 'NFLX',
    'samsung': '005930', // Korean stock
    'samsung electronics': '005930',
    'intel': 'INTC',
    'amd': 'AMD',
    'oracle': 'ORCL',
    'ibm': 'IBM',
    'cisco': 'CSCO',
    'adobe': 'ADBE',
    'salesforce': 'CRM',
    'paypal': 'PYPL',
    'visa': 'V',
    'mastercard': 'MA',
    'jpmorgan': 'JPM',
    'bank of america': 'BAC',
    'goldman sachs': 'GS',
    'morgan stanley': 'MS',
    'disney': 'DIS',
    'nike': 'NKE',
    'coca cola': 'KO',
    'pepsi': 'PEP',
    'walmart': 'WMT',
    'target': 'TGT',
    'home depot': 'HD',
    'mcdonalds': 'MCD',
    'starbucks': 'SBUX'
  };
  
  /**
   * Get symbol from common company name mapping
   * @param {string} name
   * @returns {string | undefined}
   */
  function getSymbolFromMapping(name) {
    return commonCompanyMappings[name];
  }

  /**
   * @param {string} url
   */
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API Error ${res.status}: ${errorText}`);
    }
    const data = await res.json();
    
    // Check if response is an error object
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if ('Error Message' in data || 'error' in data || 'message' in data) {
        const errorMsg = data['Error Message'] || data.error || data.message || 'Unknown API error';
        throw new Error(errorMsg);
      }
    }
    
    return data;
  }

  try {
    let symbol = '';
    let companyName = term;
    const termUpper = term.toUpperCase().trim();
    let lastError = null; // Track errors for better error messages
    
    // Strategy 1: Try if the term is already a valid stock symbol
    // Stock symbols are typically 1-10 characters, alphanumeric, may include dots or hyphens
    const isLikelySymbol = /^[A-Z0-9.-]{1,10}$/.test(termUpper);
    
    if (isLikelySymbol) {
      // Try to use it directly as a symbol
      try {
        const profileTestUrl = `${FMP_BASE}/profile?symbol=${termUpper}&apikey=${apiKey}`;
        const profileTest = await fetchJSON(profileTestUrl);
        const testProfile = Array.isArray(profileTest) ? profileTest[0] : profileTest;
        if (testProfile && (testProfile.symbol || testProfile.companyName || testProfile.name)) {
          symbol = (testProfile.symbol || termUpper).toUpperCase();
          companyName = testProfile.companyName || testProfile.name || testProfile.symbol || termUpper;
        }
      } catch (e) {
        // Not a valid symbol, continue to search by name
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    
    // Strategy 2: If not found as symbol, try searching by company name or symbol
    if (!symbol) {
      // First, try common company name mappings (fast fallback)
      const termLower = term.toLowerCase().trim();
      const mappedSymbol = getSymbolFromMapping(termLower);
      if (mappedSymbol) {
        try {
          const profileTestUrl = `${FMP_BASE}/profile?symbol=${mappedSymbol}&apikey=${apiKey}`;
          const profileTest = await fetchJSON(profileTestUrl);
          const testProfile = Array.isArray(profileTest) ? profileTest[0] : profileTest;
          if (testProfile && (testProfile.symbol || testProfile.companyName || testProfile.name)) {
            symbol = (testProfile.symbol || mappedSymbol).toUpperCase();
            companyName = testProfile.companyName || testProfile.name || testProfile.symbol || mappedSymbol;
          }
        } catch (e) {
          // Mapping didn't work, continue to API search
        }
      }
      
      // If mapping didn't work, try multiple search strategies - search by name first, then by symbol
      if (!symbol) {
        const searchStrategies = [
          // Strategy 2a: /search-name with query parameter (search by company name)
          { name: 'search-name (query)', url: `${FMP_BASE}/search-name?query=${encodeURIComponent(term)}&apikey=${apiKey}` },
          // Strategy 2b: /search-name with _query_ parameter (alternative format)
          { name: 'search-name (_query_)', url: `${FMP_BASE}/search-name?_query_=${encodeURIComponent(term)}&apikey=${apiKey}` },
          // Strategy 2c: /search endpoint (general search)
          { name: 'search', url: `${FMP_BASE}/search?query=${encodeURIComponent(term)}&apikey=${apiKey}` },
          // Strategy 2d: /search-symbol endpoint (search by symbol if name didn't work)
          { name: 'search-symbol', url: `${FMP_BASE}/search-symbol?query=${encodeURIComponent(termUpper)}&apikey=${apiKey}` }
        ];
      for (const strategy of searchStrategies) {
        try {
          const search = await fetchJSON(strategy.url);
          
          // Validate search response - stable API might return array directly or wrapped
          let searchResults = [];
          if (Array.isArray(search)) {
            searchResults = search;
          } else if (search && typeof search === 'object') {
            // Check if it's wrapped in a property
            const arrayProp = Object.values(search).find(val => Array.isArray(val));
            if (arrayProp) {
              searchResults = arrayProp;
            } else if (search.data && Array.isArray(search.data)) {
              searchResults = search.data;
            } else if (search.results && Array.isArray(search.results)) {
              searchResults = search.results;
            }
          }
          
          if (searchResults.length > 0) {
            // Find the best match
            // For name searches: prefer exact name matches
            // For symbol searches: prefer exact symbol matches
            const termLower = term.toLowerCase();
            const bestMatch = searchResults.find((/** @type {any} */ r) => {
              const rSymbol = (r.symbol || '').toUpperCase();
              const rName = (r.name || r.companyName || '').toLowerCase();
              // Exact symbol match
              if (rSymbol === termUpper) return true;
              // Exact name match
              if (rName === termLower) return true;
              // Name contains search term
              if (rName.includes(termLower)) return true;
              // Symbol contains search term
              if (rSymbol.includes(termUpper)) return true;
              return false;
            }) || searchResults[0];
            
            symbol = (bestMatch?.symbol || '').toUpperCase();
            companyName = bestMatch?.name || bestMatch?.companyName || bestMatch?.symbol || symbol;
            
            if (symbol) {
              break; // Found a match, exit the loop
            }
          }
        } catch (searchError) {
          // Store the last error for better error messages
          lastError = searchError instanceof Error ? searchError.message : String(searchError);
          // Try next strategy
          continue;
        }
        }
      }
      
      // If all search strategies failed, try fallback: use stock-list endpoint
      if (!symbol) {
        try {
          // Try to get stock list and search through it (limited to first 1000 for performance)
          const stockListUrl = `${FMP_BASE}/stock-list?apikey=${apiKey}`;
          const stockList = await fetchJSON(stockListUrl);
          
          let stocks = [];
          if (Array.isArray(stockList)) {
            stocks = stockList;
          } else if (stockList && typeof stockList === 'object') {
            const arrayProp = Object.values(stockList).find(val => Array.isArray(val));
            if (arrayProp) {
              stocks = arrayProp;
            }
          }
          
          if (stocks.length > 0) {
            const termLower = term.toLowerCase();
            // Search through stocks for name or symbol match
            const match = stocks.find((/** @type {any} */ stock) => {
              const stockName = (stock.name || stock.companyName || '').toLowerCase();
              const stockSymbol = (stock.symbol || '').toUpperCase();
              return stockName.includes(termLower) || stockSymbol === termUpper || stockSymbol.includes(termUpper);
            });
            
            if (match) {
              symbol = (match.symbol || '').toUpperCase();
              companyName = match.name || match.companyName || match.symbol || symbol;
            }
          }
        } catch (listError) {
          // Stock list fallback also failed, continue to error message
        }
      }
    }
    
    if (!symbol) {
      // Provide helpful error message based on what we know
      const errorHint = lastError 
        ? `\n\nTechnical details: ${lastError.substring(0, 200)}`
        : '';
      
      throw new Error(`Unable to find company "${term}". 
      
The search functionality may not be available in your API plan, or the company may not be in the database.

Please try:
• Using the stock symbol instead (e.g., "MSFT" for Microsoft, "AAPL" for Apple)
• Checking the spelling of the company name
• Using a different company name or symbol${errorHint}`);
    }

    // Price chart data using stable /historical-price-eod/light endpoint
    // Using /light instead of /full since we only need close prices for the chart
    const priceUrl = `${FMP_BASE}/historical-price-eod/light?symbol=${symbol}&apikey=${apiKey}`;
    const priceDataRaw = await fetchJSON(priceUrl);
    
    // Debug: Log response structure if empty (uncomment for debugging)
    // if (!priceDataRaw || (Array.isArray(priceDataRaw) && priceDataRaw.length === 0) || 
    //     (typeof priceDataRaw === 'object' && !Array.isArray(priceDataRaw) && Object.keys(priceDataRaw).length === 0)) {
    //   console.log('Empty or unexpected price data response for', symbol, ':', JSON.stringify(priceDataRaw, null, 2));
    // }

    // Handle different response formats from stable API
    // The stable API might return: { historical: [...] } or directly an array, or { symbol: "...", historical: [...] }
    let historical = [];
    if (Array.isArray(priceDataRaw)) {
      // Direct array response
      historical = priceDataRaw;
    } else if (priceDataRaw?.historical && Array.isArray(priceDataRaw.historical)) {
      // Wrapped in historical property
      historical = priceDataRaw.historical;
    } else if (priceDataRaw && typeof priceDataRaw === 'object') {
      // Check if it's an object with symbol key containing historical array
      const symbolKey = Object.keys(priceDataRaw).find(key => 
        priceDataRaw[key]?.historical && Array.isArray(priceDataRaw[key].historical)
      );
      if (symbolKey) {
        historical = priceDataRaw[symbolKey].historical;
      } else {
        // Check if the object itself contains price data arrays
        const arrayValues = Object.values(priceDataRaw).filter(val => Array.isArray(val));
        if (arrayValues.length > 0) {
          historical = arrayValues[0]; // Use first array found
        }
      }
    }

    // Normalize historical data - /light endpoint returns date and price (not close)
    historical = historical.map((/** @type {any} */ entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return {
        date: entry.date || '',
        close: Number(entry.price || 0) || 0
      };
    }).filter((/** @type {any} */ entry) => entry !== null && entry.date && entry.close > 0);

    // Normalize priceData structure for frontend
    const priceData = { historical };

    // Company profile (for stats such as market cap, shares, volume) using stable /profile endpoint
    const profileUrl = `${FMP_BASE}/profile?symbol=${symbol}&apikey=${apiKey}`;
    const profileResponse = await fetchJSON(profileUrl);
    const companyProfile = Array.isArray(profileResponse) ? profileResponse[0] ?? {} : profileResponse ?? {};

    // Basic stats derived from profile + price history
    // Get latest close price - historical data might be in different order
    // Sort by date descending to get most recent first
    const sortedHistorical = [...historical].sort((a, b) => {
      const dateA = a?.date ? new Date(a.date).getTime() : 0;
      const dateB = b?.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
    const latestClose = sortedHistorical[0]?.close ?? historical[0]?.close ?? companyProfile.price ?? null;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const lastYear = historical.filter((/** @type {{date?: string}} */ entry) => {
      const date = entry?.date ? new Date(entry.date) : null;
      return date ? date >= cutoff : false;
    });
    const closes = (lastYear.length ? lastYear : historical)
      .map((/** @type {{close?: number}} */ entry) => entry?.close)
      .filter((/** @type {unknown} */ value) => typeof value === 'number');

    const basicStats = {
      price: companyProfile.price ?? latestClose ?? null,
      currency: companyProfile.currency ?? 'USD',
      fiftyTwoWeekLow: closes.length ? Math.min(...closes) : null,
      fiftyTwoWeekHigh: closes.length ? Math.max(...closes) : null,
      marketCap: companyProfile.mktCap ?? null,
      sharesOutstanding: companyProfile.sharesOutstanding ?? null,
      freeFloat: companyProfile.floatShares ?? null,
      avgTradingVolume: companyProfile.volAvg ?? null
    };

    // Ownership data: Acquisition of Beneficial Ownership (stable endpoint)
    // See: https://financialmodelingprep.com/stable/acquisition-of-beneficial-ownership
    /** @type {Array<any>} */
    let ownershipData = [];
    try {
      const acquisitionUrl = `${FMP_BASE}/acquisition-of-beneficial-ownership?symbol=${symbol}&apikey=${apiKey}`;
      const raw = await fetchJSON(acquisitionUrl);

      // Handle different response formats
      let rows = [];
      if (Array.isArray(raw)) {
        rows = raw;
      } else if (raw && typeof raw === 'object') {
        // Check if it's wrapped in a property
        const arrayProp = Object.values(raw).find(val => Array.isArray(val));
        if (arrayProp) {
          rows = arrayProp;
        } else if (raw.data && Array.isArray(raw.data)) {
          rows = raw.data;
        }
      }

      // Map API shape to the fields expected by the frontend table
      // Try multiple possible field name variations
      ownershipData = rows.map((/** @type {any} */ row) => ({
        name: row.nameOfReportingPerson || row.name || row.reportingPerson || '',
        sharesOwned: Number(row.amountBeneficiallyOwned || row.sharesOwned || row.amount || 0) || 0,
        ownershipPercentage: Number(row.percentOfClass || row.ownershipPercentage || row.percent || 0) || 0,
        soleVotingPower: Number(row.soleVotingPower || row.soleVoting || 0) || 0,
        sharedVotingPower: Number(row.sharedVotingPower || row.sharedVoting || 0) || 0,
        soleDispositivePower: Number(row.soleDispositivePower || row.soleDispositive || 0) || 0,
        sharedDispositivePower: Number(row.sharedDispositivePower || row.sharedDispositive || 0) || 0,
        filingDate: row.filingDate || row.date || row.filing || '',
        url: row.url || row.link || '',
        typeOfReportingPerson: row.typeOfReportingPerson || row.type || ''
      }));
    } catch (ownershipError) {
      console.warn(`Failed to fetch acquisition-of-beneficial-ownership data for ${symbol}:`, ownershipError);
      ownershipData = [];
    }

    return { symbol, companyName, priceData, ownershipData, basicStats };
  } catch (error) {
    // Re-throw with more context
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch company data: ${message}`);
  }
}
