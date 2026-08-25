// api/index.js
export default async function handler(req, res) {
  // Universal Open CORS for all external sites
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { game = 'K3_1M', ts = Date.now() } = req.query;

  // Exact endpoints from your network capture
  const historyUrl = `https://draw.ar-lottery01.com/K3/${game}/GetHistoryIssuePage.json?ts=${ts}`;
  const latestUrl = `https://draw.ar-lottery01.com/K3/${game}.json?ts=${ts}`;

  const requestHeaders = {
    'authority': 'draw.ar-lottery01.com',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'origin': 'https://19yaarwin.com',
    'referer': 'https://19yaarwin.com/',
    'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
  };

  // Helper to fetch and cleanly parse application/octet-stream & UTF-8
  async function fetchCleanJson(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: requestHeaders
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    // Read as ArrayBuffer to handle octet-stream and remove UTF-8 BOM
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    let text = decoder.decode(arrayBuffer);

    // Strip BOM character if present (\uFEFF)
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    text = text.trim();

    return JSON.parse(text);
  }

  try {
    let historyJson = null;
    let latestJson = null;

    // Try fetching history list
    try {
      historyJson = await fetchCleanJson(historyUrl);
    } catch (e) {
      console.warn("History fetch failed, trying latest...", e.message);
    }

    // Try fetching current latest draw
    try {
      latestJson = await fetchCleanJson(latestUrl);
    } catch (e) {
      console.warn("Latest draw fetch failed", e.message);
    }

    // Extract list
    let rawList = [];
    if (Array.isArray(historyJson)) {
      rawList = historyJson;
    } else if (historyJson?.data?.list) {
      rawList = historyJson.data.list;
    } else if (historyJson?.list) {
      rawList = historyJson.list;
    } else if (historyJson?.data?.rows) {
      rawList = historyJson.data.rows;
    } else if (latestJson) {
      rawList = Array.isArray(latestJson) ? latestJson : [latestJson.data || latestJson];
    }

    // Standardize every draw record
    const formattedList = rawList.map((item) => {
      const issue = String(
        item.issueName ||
        item.issueNumber ||
        item.issue_number ||
        item.period ||
        item.issue ||
        item.id ||
        ''
      );

      let dice = [];
      if (typeof item.openNum === 'string') {
        dice = item.openNum.split(/[,|\s]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      } else if (Array.isArray(item.numbers)) {
        dice = item.numbers.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
      } else if (typeof item.result === 'string') {
        dice = item.result.split(/[,|\s]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      } else if (typeof item.number === 'string') {
        dice = item.number.split(/[,|\s]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      }

      const sum = (item.sum !== undefined && item.sum !== null && !isNaN(Number(item.sum)))
        ? Number(item.sum)
        : (dice.length > 0 ? dice.reduce((a, b) => a + b, 0) : 0);

      const size = item.bigSmall || (sum >= 11 ? 'Big' : 'Small');
      const parity = item.oddEven || (sum % 2 === 0 ? 'Even' : 'Odd');
      const openTime = item.openTime || item.createTime || item.time || '';

      return {
        issue: issue,
        dice: dice,
        sum: sum,
        size: size,
        parity: parity,
        openTime: openTime,
        raw: item
      };
    });

    return res.status(200).json({
      success: true,
      game: game,
      timestamp: Date.now(),
      total: formattedList.length,
      latestIssue: formattedList[0]?.issue || null,
      data: formattedList
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      game: game,
      error: error.message || 'Error processing K3 stream'
    });
  }
                                                }
