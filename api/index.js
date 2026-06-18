export default async function handler(req, res) {
  // Cấu hình CORS
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
      redirect: 'manual'
    });

    // Tải toàn bộ mã nguồn HTML gốc từ YouTube về
    const htmlContent = await response.text();

    // TRƯỜNG HỢP 1: Người dùng muốn lấy FILE HTML RAW gốc từ YouTube
    if (raw === 'true') {
      // Trả về định dạng text/plain để trình duyệt hiển thị dạng code mã nguồn thuần tuý, không tự render
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    // Kiểm tra dấu hiệu Live nghiêm ngặt cho 2 trường hợp còn lại
    const isRedirect = response.status === 301 || response.status === 302;
    const hasLiveSignal = htmlContent.includes('"isLive":true') || htmlContent.includes('"isLiveStream":true') || htmlContent.includes('iconType":"LIVE"');
    const isLive = !isRedirect && hasLiveSignal;

    let streamId = null;
    if (isLive) {
      const ytCommandMatch = htmlContent.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
      if (ytCommandMatch && ytCommandMatch[1]) {
        streamId = ytCommandMatch[1];
      }
      if (!streamId) {
        const alternativeMatch = htmlContent.match(/"videoId"\s*:\s*"([\w-]{11})"\s*,\s*"isLive"/);
        if (alternativeMatch && alternativeMatch[1]) streamId = alternativeMatch[1];
      }
    }

    // TRƯỜNG HỢP 2: Người dùng muốn xem Giao diện thông báo HTML (Vercel tự render)
    if (html === 'true') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      const bgColor = isLive ? '#22c55e' : '#ef4444';
      const statusText = isLive ? '🔴 STREAM IS LIVE' : '⚪ STREAM OFFLINE';
      const subText = isLive 
        ? `Found Stream ID: <strong style="font-family:monospace; background:#fff; padding:2px 6px; border-radius:4px; color:#111;">${streamId || 'Unknown'}</strong>` 
        : `Status: LIVE_NOT_FOUND`;

      return res.status(isLive ? 200 : 404).send(`
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

    // TRƯỜNG HỢP 3 (MẶC ĐỊNH): Trả về chuỗi 11 ký tự Stream ID hoặc LIVE_NOT_FOUND phục vụ code chat box
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
