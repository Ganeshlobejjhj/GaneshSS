// api/index.js
export default async function handler(req, res) {
  // Universal Open CORS for all external sites
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { game = 'K3_1M', ts = Date.now() } = req.query;

  // Exact Endpoint used by 19yaarwin.com
  const targetUrl = `https://draw.ar-lottery01.com/K3/${game}/GetHistoryIssuePage.json?ts=${ts}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
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
      }
    });

    const rawJson = await response.json();

    // 19yaarwin data structures: rawJson.data.list OR rawJson.data.rows OR rawJson.list
    let rawList = [];
    if (Array.isArray(rawJson)) {
      rawList = rawJson;
    } else if (rawJson?.data?.list && Array.isArray(rawJson.data.list)) {
      rawList = rawJson.data.list;
    } else if (rawJson?.data?.rows && Array.isArray(rawJson.data.rows)) {
      rawList = rawJson.data.rows;
    } else if (rawJson?.list && Array.isArray(rawJson.list)) {
      rawList = rawJson.list;
    } else if (rawJson?.data && Array.isArray(rawJson.data)) {
      rawList = rawJson.data;
    }

    // Exact field extraction matching screenshot & official K3 rules
    const formattedList = rawList.map((item) => {
      // 1. Exact Period ID (e.g., 2026082510100412)
      const period = String(
        item.issueName ||
        item.issueNumber ||
        item.issue_number ||
        item.period ||
        item.issue ||
        item.id ||
        ''
      );

      // 2. Exact 3 Dice Numbers extraction
      let dice = [];
      if (typeof item.openNum === 'string') {
        dice = item.openNum.split(/[,|\s|]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      } else if (Array.isArray(item.numbers)) {
        dice = item.numbers.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
      } else if (typeof item.result === 'string') {
        dice = item.result.split(/[,|\s|]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      } else if (typeof item.number === 'string') {
        dice = item.number.split(/[,|\s|]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      }

      // 3. Exact Sum Calculation
      const sum = (item.sum !== undefined && item.sum !== null && !isNaN(Number(item.sum)))
        ? Number(item.sum)
        : (dice.length > 0 ? dice.reduce((a, b) => a + b, 0) : 0);

      // 4. Exact Big / Small (K3 Standard: 3-10 Small, 11-18 Big)
      const size = item.bigSmall || (sum >= 11 ? 'Big' : 'Small');

      // 5. Exact Odd / Even (Sum Parity)
      const parity = item.oddEven || (sum % 2 === 0 ? 'Even' : 'Odd');

      // 6. Draw Open Time
      const openTime = item.openTime || item.createTime || item.create_time || item.time || '';

      return {
        period: period,
        sum: sum,
        size: size,           // "Small" ya "Big"
        parity: parity,       // "Odd" ya "Even"
        dice: dice,           // [1, 2, 4]
        openTime: openTime,
        raw: item             // Original raw item from server for 100% precision
      };
    });

    return res.status(200).json({
      success: true,
      game: game,
      timestamp: Date.now(),
      totalRecords: formattedList.length,
      latest: formattedList[0] || null,
      data: formattedList
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      game: game,
      error: error.message || 'Failed to fetch original K3 data'
    });
  }
                                      }
