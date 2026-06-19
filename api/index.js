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
      redirect: 'manual'
    });

    // Tải toàn bộ mã nguồn HTML gốc từ YouTube về
    const htmlContent = await response.text();

    // TRƯỜNG HỢP 1: Nếu người dùng muốn lấy RAW HTML, trả về ngay lập tức
    if (raw === 'true' || req.url.includes('raw=true')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    let streamId = null;

    // QUÉT REGEX THEO YÊU CẦU: Tìm videoId xuất hiện sau cụm "apiUrl":"/youtubei/v1/like/like"
    // Regex này sẽ tìm chuỗi /like/like, sau đó quét tiếp một đoạn ngắn tìm cặp cấu trúc "videoId":"..." gần nhất
    const likeRegex = /"apiUrl"\s*:\s*"\/youtubei\/v1\/like\/like".*?"videoId"\s*:\s*"([\w-]{11})"/s;
    const match = htmlContent.match(likeRegex);
    
    if (match && match[1]) {
      streamId = match[1];
    }

    // Phương án dự phòng 1: Nếu cấu trúc trên lỗi, quét theo watchEndpoint cũ (từ file pt.html của bạn)
    if (!streamId) {
      const ytCommandMatch = htmlContent.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
      if (ytCommandMatch && ytCommandMatch[1]) {
        streamId = ytCommandMatch[1];
      }
    }

    // TRƯỜNG HỢP 2: Nếu người dùng muốn xem giao diện báo trạng thái HTML (&html=true)
    if (html === 'true' || req.url.includes('html=true')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      const isLive = !!streamId && (response.status !== 301 && response.status !== 302);
      const bgColor = isLive ? '#22c55e' : '#ef4444';
      const statusText = isLive ? '🔴 STREAM IS LIVE' : '⚪ STREAM OFFLINE';
      const subText = isLive 
        ? `Found Stream ID: <strong style="font-family:monospace; background:#fff; padding:2px 6px; border-radius:4px; color:#111;">${streamId}</strong>` 
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

    // TRƯỜNG HỢP 3: Mặc định (Dành cho code Chat Box) -> Chỉ trả lại chuỗi 11 ký tự Stream ID
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    if (streamId && response.status !== 301 && response.status !== 302) {
      return res.status(200).send(streamId);
    }
    
    return res.status(404).send("LIVE_NOT_FOUND");

  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send(`ERROR: ${error.message}`);
  }
}
