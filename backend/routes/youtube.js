import express from 'express';
import https from 'https';
import youtubeSearchApi from 'youtube-search-api';
import ytdl from 'ytdl-core';

const router = express.Router();
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

const STREAM_HEADERS = {
  'User-Agent': USER_AGENT,
  Referer: 'https://www.youtube.com/',
  Origin: 'https://www.youtube.com',
  Range: 'bytes=0-',
};

const pipeDirectFromFormat = async (videoUrl, res) => {
  const info = await ytdl.getInfo(videoUrl);
  const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
  if (!format?.url) {
    throw new Error('No audio format available');
  }

  await new Promise((resolve, reject) => {
    const request = https.get(format.url, { headers: STREAM_HEADERS }, (upstream) => {
      if (!res.headersSent) {
        const mimeType = format.mimeType?.split(';')?.[0] || upstream.headers['content-type'] || 'audio/webm';
        res.setHeader('Content-Type', mimeType);
      }
      upstream.pipe(res);
      upstream.on('end', resolve);
      upstream.on('error', reject);
    });

    request.on('error', reject);
    res.on('close', () => request.destroy());
  });
};

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

    await new Promise((resolve, reject) => {
      const audioStream = ytdl(videoUrl, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        dlChunkSize: 0,
        requestOptions: {
          headers: STREAM_HEADERS,
        },
      });

      const cleanup = () => {
        audioStream.destroy();
      };

      audioStream.once('info', (_info, format) => {
        const mimeType = format?.mimeType?.split(';')?.[0] || 'audio/webm';
        if (!res.headersSent) {
          res.setHeader('Content-Type', mimeType);
        }
      });

      audioStream.on('error', async (err) => {
        console.error('YouTube audio stream error', err);
        cleanup();
        if (err.message?.includes('Status code: 410')) {
          try {
            await pipeDirectFromFormat(videoUrl, res);
            resolve();
            return;
          } catch (fallbackErr) {
            reject(fallbackErr);
            return;
          }
        }
        reject(err);
      });

      res.on('close', cleanup);
      audioStream.on('end', resolve);
      audioStream.pipe(res);
    });
  } catch (err) {
    console.error('Failed to stream YouTube audio', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Audio extraction failed', details: err.message });
    } else {
      res.destroy(err);
    }
  }
});

export default router;
