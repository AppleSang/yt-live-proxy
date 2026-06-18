export default async function handler(req, res) {
  // Cấu hình CORS Header cho phép mọi domain truy cập (giống Cloudflare Worker)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Xử lý request OPTIONS (Preflight request của trình duyệt)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Lấy tham số ?url= từ request
  const { url } = req.query;

  if (!url) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(400).send("Missing url parameter // Example: ?url=https://www.youtube.com/channel/{channel_id}/live");
  }

  try {
    // Thực hiện gọi tới YouTube với User-Agent giả lập trình duyệt và chặn tự động Redirect
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'manual' // Chặn không cho YouTube tự chuyển hướng sang video cũ khi offline
    });

    // Nếu YouTube trả về 301/302 -> Kênh chắc chắn đang OFFLINE
    if (response.status === 301 || response.status === 302) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(404).send("LIVE_NOT_FOUND");
    }

    const html = await response.text();

    // KIỂM TRA NGHIÊM NGẶT: Phải có chữ "isLive":true trong HTML mới xử lý tiếp
    if (!html.includes('"isLive":true') && !html.includes('"isLiveStream":true')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(404).send("LIVE_NOT_FOUND");
    }

    let streamId = null;

    // Bước quét 1: Quét cấu trúc watchEndpoint chuẩn dựa trên file phân tích của bạn
    const ytCommandMatch = html.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
    if (ytCommandMatch && ytCommandMatch[1]) {
      streamId = ytCommandMatch[1];
    }

    // Bước quét 2: Dự phòng nếu cấu trúc thay đổi nhẹ
    if (!streamId) {
      const m = html.match(/"videoId"\s*:\s*"([\w-]{11})"\s*,\s*"isLive"/);
      if (m) streamId = m[1];
    }

    // Nếu tìm thấy đúng ID phòng Live
    if (streamId) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(200).send(streamId);
    }

    // Nếu không quét được ID nào hợp lệ
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(404).send("LIVE_NOT_FOUND");

  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send(`ERROR: ${error.message}`);
  }
}
