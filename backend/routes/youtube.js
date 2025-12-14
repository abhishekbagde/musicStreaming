import express from 'express';
const router = express.Router();
import youtubeSearchApi from 'youtube-search-api';

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


// GET /api/youtube/audio?videoId=VIDEO_ID
import ytdlp from 'yt-dlp-exec';
import { PassThrough } from 'stream';

router.get('/audio', async (req, res) => {
  let videoId = req.query.videoId
  const url = req.query.url

  // Support both videoId and full URL
  if (!videoId && url) {
    const match = url.match(/v=([^&]+)/)
    videoId = match ? match[1] : null
  }

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId or url' })
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  try {
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'no-cache')
    
    // Use yt-dlp to extract and stream audio
    const ytdlpStream = ytdlp.exec(videoUrl, {
      output: '-',
      format: 'bestaudio[ext=mp3]/bestaudio/best',
      quiet: true,
      limitRate: '1M',
    }, { stdio: ['ignore', 'pipe', 'ignore'] })

    ytdlpStream.stdout.pipe(res)
    ytdlpStream.on('error', (err) => {
      res.status(500).end('Audio extraction failed');
    });
    res.on('close', () => {
      ytdlpStream.kill();
    });
  } catch (err) {
    res.status(500).json({ error: 'Audio extraction failed', details: err.message });
  }
});

export default router;
