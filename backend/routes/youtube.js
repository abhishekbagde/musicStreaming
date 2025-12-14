import express from 'express';
import youtubeSearchApi from 'youtube-search-api';

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
export default router;
