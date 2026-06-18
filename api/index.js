export default async function handler(req, res) {
  // Cấu hình CORS cho phép mọi domain truy cập
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, raw, html } = req.query;

  if (!url) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(400).send("Missing url parameter");
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'manual' // Giữ nguyên phản hồi gốc, không tự động chuyển hướng
    });

    // Tải toàn bộ mã nguồn HTML gốc từ YouTube về
    const htmlContent = await response.text();

    // 🔥 ĐIỀU KIỆN QUAN TRỌNG: Nếu có tham số raw=true (hoặc viết nhầm trong chuỗi url), TRẢ VỀ RAW FILE NGAY
    if (raw === 'true' || req.url.includes('raw=true')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    // --- CÁC LOGIC XỬ LÝ ĐỂ LẤY STREAM-ID MẶC ĐỊNH CHO CHAT BOX ---
    const isRedirect = response.status === 301 || response.status === 302;
    const hasLiveSignal = htmlContent.includes("window['ytCommand']") && htmlContent.includes("'/live'");
    const isLive = !isRedirect && hasLiveSignal;

    let streamId = null;
    if (isLive) {
      const ytCommandMatch = htmlContent.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
      if (ytCommandMatch && ytCommandMatch[1]) {
        streamId = ytCommandMatch[1];
      }
    }

    // Nếu muốn xem giao diện HTML (&html=true)
    if (html === 'true' || req.url.includes('html=true')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      const bgColor = (isLive && streamId) ? '#22c55e' : '#ef4444';
      const statusText = (isLive && streamId) ? '🔴 STREAM IS LIVE' : '⚪ STREAM OFFLINE';
      const subText = (isLive && streamId) 
        ? `Found Stream ID: <strong style="font-family:monospace; background:#fff; padding:2px 6px; border-radius:4px; color:#111;">${streamId}</strong>` 
        : `Status: LIVE_NOT_FOUND`;

      return res.status((isLive && streamId) ? 200 : 404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Stream Status Checker</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f4f6; }
            .card { background: white; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 400px; width: 100%; }
            .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; color: white; font-weight: bold; font-size: 0.9rem; margin-bottom: 15px; background: ${bgColor}; }
            .msg { color: #4b5563; font-size: 1.1rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">${statusText}</div>
            <div class="msg">${subText}</div>
          </div>
        </body>
        </html>
      `);
    }

    // Mặc định (Không truyền tham số gì): Chỉ trả ra chuỗi 11 ký tự Stream ID cho chat box
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    if (isLive && streamId) {
      return res.status(200).send(streamId);
    }
    
    return res.status(404).send("LIVE_NOT_FOUND");

  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send(`ERROR: ${error.message}`);
  }
}
