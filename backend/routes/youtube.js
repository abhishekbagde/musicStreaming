import express from 'express';
import youtubeSearchApi from 'youtube-search-api';
import ytdl from 'ytdl-core';

const router = express.Router();

// GET /api/youtube/search?q=QUERY
router.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }
  try {
    const results = await youtubeSearchApi.GetListByKeyword(query, false, 10);
    // Map to minimal song info for queue
    const videos = (results.items || []).filter(item => item.type === 'video').map(item => ({
      id: item.id,
      title: item.title,
      author: item.channelTitle,
      duration: item.length && item.length.simpleText,
      thumbnail: item.thumbnail && item.thumbnail[0]?.url,
      url: `https://www.youtube.com/watch?v=${item.id}`,
    }));
    res.json({ results: videos });
  } catch (err) {
    res.status(500).json({ error: 'YouTube search failed', details: err.message });
  }
});


router.get('/audio', async (req, res) => {
  let videoId = req.query.videoId;
  const url = req.query.url;

  // Support both videoId and full URL
  if (!videoId && url) {
    const match = url.match(/v=([^&]+)/);
    videoId = match ? match[1] : null;
  }

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId or url' });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const audioStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      dlChunkSize: 0, // avoid 410 errors on chunked downloads
      requestOptions: {
        headers: {
          // Pretend to be a browser to avoid throttling
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          Referer: 'https://www.youtube.com/',
          Origin: 'https://www.youtube.com',
        },
      },
    });

    audioStream.once('info', (_info, format) => {
      const mimeType = format?.mimeType?.split(';')?.[0] || 'audio/webm';
      if (!res.headersSent) {
        res.setHeader('Content-Type', mimeType);
      }
    });

    audioStream.on('error', (err) => {
      console.error('YouTube audio stream error', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Audio extraction failed', details: err.message });
      } else {
        res.destroy(err);
      }
    });

    res.on('close', () => {
      audioStream.destroy();
    });

    audioStream.pipe(res);
  } catch (err) {
    console.error('Failed to stream YouTube audio', err);
    res.status(500).json({ error: 'Audio extraction failed', details: err.message });
  }
});

export default router;
