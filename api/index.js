export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
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

    if (response.status === 301 || response.status === 302) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(404).send("LIVE_NOT_FOUND");
    }

    const html = await response.text();

    // BƯỚC KHÓA CHẶT: Kiểm tra xem trang này có thực sự ĐANG PHÁT TRỰC TIẾP không
    // Nếu không có các cờ hiệu Live này, kết luận ngay là kênh đang Offline
    if (!html.includes('"isLive":true') && !html.includes('"isLiveStream":true') && !html.includes('iconType":"LIVE"')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(404).send("LIVE_NOT_FOUND");
    }

    let streamId = null;

    // Chỉ khi xác định đúng là đang Live, mới quét tìm videoId của phòng live đó
    const ytCommandMatch = html.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
    if (ytCommandMatch && ytCommandMatch[1]) {
      streamId = ytCommandMatch[1];
    }

    // Phương án dự phòng cấu trúc JSON dạng khác của luồng Live
    if (!streamId) {
      const alternativeMatch = html.match(/"videoId"\s*:\s*"([\w-]{11})"\s*,\s*"isLive"/);
      if (alternativeMatch && alternativeMatch[1]) streamId = alternativeMatch[1];
    }

    if (streamId) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(200).send(streamId);
    }

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(404).send("LIVE_NOT_FOUND");

  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send(`ERROR: ${error.message}`);
  }
}
