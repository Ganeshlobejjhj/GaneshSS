// api/cron.js — 24/7 Vercel Background Cron Worker
export default async function handler(req, res) {
    try {
        const [resProxy, res30s] = await Promise.all([
            fetch('https://k3-proxy.vercel.app/?t=' + Date.now()).then(r => r.json()).catch(() => null),
            fetch('https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?t=' + Date.now()).then(r => r.json()).catch(() => null)
        ]);

        let proxyPred = "BIG";
        if (resProxy) {
            const rec = Array.isArray(resProxy) ? resProxy[0] : (resProxy.data?.records?.[0] || resProxy);
            let resultVal = rec.result || rec.number;
            if (resultVal !== undefined) {
                proxyPred = !isNaN(resultVal) ? (parseInt(resultVal) >= 5 ? 'BIG' : 'SMALL') : String(resultVal).toUpperCase();
            }
        }

        if (res30s?.data?.list && res30s.data.list.length > 0) {
            const list = res30s.data.list.slice(0, 50);
            const rounds = list.map(item => {
                const num = parseInt(item.number);
                const actualSize = num >= 5 ? 'BIG' : 'SMALL';
                return {
                    period: String(item.issueNumber),
                    actualNum: num,
                    actualSize: actualSize,
                    results: {
                        master: {
                            pred: proxyPred,
                            win: proxyPred === actualSize
                        }
                    }
                };
            });

            // Direct Save to Google Firebase Firestore via REST API
            const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/ai-studio-masterenginestra-24437d77-63a4-4444-b4fa-8962bfb5eeb2/databases/(default)/documents/ganesh_ss_state/main_v1';
            
            await fetch(firestoreUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        lastResultIssue: { stringValue: String(list[0].issueNumber) },
                        roundHistoryJson: { stringValue: JSON.stringify(rounds) },
                        updatedAt: { stringValue: new Date().toISOString() }
                    }
                })
            });

            return res.status(200).json({ status: 'ok', updatedIssue: list[0].issueNumber });
        }

        return res.status(200).json({ status: 'no data' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}