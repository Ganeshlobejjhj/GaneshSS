// api/index.js
export default async function handler(req, res) {
  // Sabhi external sites aur apps ke liye CORS open rakha hai
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { game = 'K3_1M', ts = Date.now() } = req.query;
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

    if (!response.ok) {
      throw new Error(`Origin server returned ${response.status}`);
    }

    const rawData = await response.json();

    let rawList = [];
    if (Array.isArray(rawData)) {
      rawList = rawData;
    } else if (rawData?.data?.list) {
      rawList = rawData.data.list;
    } else if (rawData?.list) {
      rawList = rawData.list;
    } else if (rawData?.data) {
      rawList = Array.isArray(rawData.data) ? rawData.data : [];
    }

    // Har dusri site me aasani se use karne ke liye clean JSON
    const formattedList = rawList.map((item) => {
      const issue = String(item.issueNumber || item.issueName || item.period || item.issue || '');
      
      let dice = [];
      if (Array.isArray(item.numbers)) {
        dice = item.numbers.map(Number);
      } else if (typeof item.openNum === 'string') {
        dice = item.openNum.split(/[,|\s]+/).map(Number);
      } else if (typeof item.result === 'string') {
        dice = item.result.split(/[,|\s]+/).map(Number);
      }

      const sum = dice.length > 0 ? dice.reduce((a, b) => a + b, 0) : (Number(item.sum) || 0);
      const size = sum >= 11 ? 'Big' : 'Small';
      const parity = sum % 2 === 0 ? 'Even' : 'Odd';

      return {
        issue: issue,
        dice: dice,
        sum: sum,
        size: size,       // "Big" ya "Small"
        parity: parity,   // "Odd" ya "Even"
        openTime: item.openTime || item.createTime || new Date().toISOString()
      };
    });

    return res.status(200).json({
      status: 'success',
      game: game,
      timestamp: Date.now(),
      total: formattedList.length,
      latestIssue: formattedList[0]?.issue || null,
      data: formattedList
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      game: game,
      message: error.message || 'Failed to fetch K3 history'
    });
  }
}