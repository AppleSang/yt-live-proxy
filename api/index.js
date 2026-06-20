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

    // TRƯỜNG HỢP 1: Nếu người dùng muốn lấy RAW HTML dưới dạng Text thuần (để copy/xem code)
    if (raw === 'true' || req.url.includes('raw=true')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    // 🔥 TRƯỜNG HỢP 2 (ĐÃ SỬA): Nếu truyền &html=true, ép trình duyệt tự động render nguyên bản giao diện web của YouTube
    if (html === 'true' || req.url.includes('html=true')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    // --- CÁC LOGIC QUÉT ID MẶC ĐỊNH PHỤC VỤ CHAT BOX ---
    let streamId = null;

    const likeRegex = /"apiUrl"\s*:\s*"\/youtubei\/v1\/like\/like".*?"videoId"\s*:\s*"([\w-]{11})"/s;
    const match = htmlContent.match(likeRegex);
    
    if (match && match[1]) {
      streamId = match[1];
    }

    if (!streamId) {
      const ytCommandMatch = htmlContent.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
      if (ytCommandMatch && ytCommandMatch[1]) {
        streamId = ytCommandMatch[1];
      }
    }

    // TRƯỜNG HỢP 3: Mặc định -> Chỉ trả lại chuỗi 11 ký tự Stream ID
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
