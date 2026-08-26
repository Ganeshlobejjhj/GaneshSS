// api/index.js
export default async function handler(req, res) {
  // Open CORS for all external sites
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { game = 'K3_1M', ts = Date.now() } = req.query;
  const targetUrl = `https://draw.ar-lottery01.com/K3/${game}/GetHistoryIssuePage.json?ts=${ts}`;

  // Multiple Fallback Gateways to bypass Datacenter IP blocking
  const endpoints = [
    targetUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  let rawData = null;

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
          'Origin': 'https://19yaarwin.com',
          'Referer': 'https://19yaarwin.com/'
        }
      });

      if (response.ok) {
        const text = await response.text();
        rawData = JSON.parse(text.trim());
        if (rawData) break; // Successfully fetched!
      }
    } catch (e) {
      // Try next gateway
    }
  }

  if (!rawData) {
    return res.status(500).json({
      success: false,
      game: game,
      error: "Cloudflare blocked datacenter IP. Please use Client-Side direct fetch on your site."
    });
  }

  // Extract and format clean list
  let rawList = [];
  if (Array.isArray(rawData)) rawList = rawData;
  else if (rawData?.data?.list) rawList = rawData.data.list;
  else if (rawData?.list) rawList = rawData.list;
  else if (rawData?.data) rawList = Array.isArray(rawData.data) ? rawData.data : [];

  const formatted = rawList.map((item) => {
    const period = String(item.issueName || item.issueNumber || item.period || '');
    let dice = [];
    if (typeof item.openNum === 'string') {
      dice = item.openNum.split(/[,|\s]+/).map(Number);
    } else if (Array.isArray(item.numbers)) {
      dice = item.numbers.map(Number);
    }

    const sum = (item.sum !== undefined && item.sum !== null) 
      ? Number(item.sum) 
      : (dice.length > 0 ? dice.reduce((a, b) => a + b, 0) : 0);

    return {
      period: period,
      dice: dice,
      sum: sum,
      size: sum >= 11 ? 'Big' : 'Small',
      parity: sum % 2 === 0 ? 'Even' : 'Odd',
      openTime: item.openTime || item.createTime || ''
    };
  });

  return res.status(200).json({
    success: true,
    game: game,
    timestamp: Date.now(),
    total: formatted.length,
    latest: formatted[0] || null,
    data: formatted
  });
}
