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

  // URLs as seen in your network tab
  const historyUrl = `https://draw.ar-lottery01.com/K3/${game}/GetHistoryIssuePage.json?ts=${ts}`;
  const latestUrl = `https://draw.ar-lottery01.com/K3/${game}.json?ts=${ts}`;

  const headers = {
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

  async function fetchRaw(url) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    let text = decoder.decode(buffer);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return JSON.parse(text.trim());
  }

  try {
    let rawPayload = null;

    // 1. Pehle History Page fetch karne ki koshish
    try {
      rawPayload = await fetchRaw(historyUrl);
    } catch (err) {
      console.warn("History fetch failed, fallback to latest url:", err.message);
    }

    // 2. Agar history khali ho toh single/latest K3_1M.json fetch karein
    if (!rawPayload) {
      try {
        rawPayload = await fetchRaw(latestUrl);
      } catch (err) {
        throw new Error("Both history and latest endpoints failed: " + err.message);
      }
    }

    // 3. Robust List Extractor (Sabhi possible keys check karega)
    let rawList = [];
    if (Array.isArray(rawPayload)) {
      rawList = rawPayload;
    } else if (Array.isArray(rawPayload?.data?.list)) {
      rawList = rawPayload.data.list;
    } else if (Array.isArray(rawPayload?.data?.rows)) {
      rawList = rawPayload.data.rows;
    } else if (Array.isArray(rawPayload?.list)) {
      rawList = rawPayload.list;
    } else if (Array.isArray(rawPayload?.data)) {
      rawList = rawPayload.data;
    } else if (Array.isArray(rawPayload?.rows)) {
      rawList = rawPayload.rows;
    } else if (rawPayload?.data && typeof rawPayload.data === 'object') {
      rawList = [rawPayload.data];
    } else if (rawPayload && typeof rawPayload === 'object') {
      rawList = [rawPayload];
    }

    // 4. Standard Clean Formatting
    const formattedList = rawList
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        // Period ID
        const period = String(
          item.issueName ||
          item.issueNumber ||
          item.issue_number ||
          item.period ||
          item.issue ||
          item.id ||
          item.issue_no ||
          ''
        );

        // 3 Dice Numbers Extraction
        let dice = [];
        if (typeof item.openNum === 'string') {
          dice = item.openNum.split(/[,|\s|]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
        } else if (Array.isArray(item.numbers)) {
          dice = item.numbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
        } else if (Array.isArray(item.numList)) {
          dice = item.numList.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
        } else if (typeof item.result === 'string') {
          dice = item.result.split(/[,|\s|]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
        } else if (typeof item.number === 'string') {
          dice = item.number.split(/[,|\s|]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
        }

        // Sum Calculation
        const sum = (item.sum !== undefined && item.sum !== null && !isNaN(Number(item.sum)))
          ? Number(item.sum)
          : (dice.length > 0 ? dice.reduce((a, b) => a + b, 0) : (Number(item.sumNum) || 0));

        const size = item.bigSmall || (sum >= 11 ? 'Big' : 'Small');
        const parity = item.oddEven || (sum % 2 === 0 ? 'Even' : 'Odd');
        const openTime = item.openTime || item.createTime || item.time || '';

        return {
          period: period,
          dice: dice,
          sum: sum,
          size: size,       // "Big" (11-18) ya "Small" (3-10)
          parity: parity,   // "Odd" ya "Even"
          openTime: openTime,
          rawItem: item     // Original server item for full reference
        };
      });

    return res.status(200).json({
      success: true,
      game: game,
      timestamp: Date.now(),
      total: formattedList.length,
      latestIssue: formattedList[0]?.period || null,
      data: formattedList,
      rawServerResponse: rawPayload // Complete unmodified server payload
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      game: game,
      error: error.message
    });
  }
      }
