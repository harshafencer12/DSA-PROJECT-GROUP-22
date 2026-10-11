const express = require('express');
const cors = require('cors');
const { checkDatabase } = require('./db');
const {
  getItems,
  getUsers,
  getStats,
  getGenres,
  recommend,
  searchMovies,
  getGraph,
  saveInteraction,
  savePreferences
} = require('./recommender');

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await checkDatabase();
    res.json({ status: 'ok', database: 'connected', service: 'DSA Recommendation Engine' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected', message: error.message });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    const { q = '', limit = 50, offset = 0 } = req.query;
    res.json(await getItems({ q, limit, offset }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try { res.json(await getUsers()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/stats', async (req, res) => {
  try { res.json(await getStats()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/genres', async (req, res) => {
  try { res.json(await getGenres()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Search query is required' });
    res.json(await searchMovies(q));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/graph/:id', async (req, res) => {
  try {
    const result = await getGraph(req.params.id);
    if (!result) return res.status(404).json({ error: 'Movie not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recommend', async (req, res) => {
  try {
    const { userId = 1, genres = [], tags = [], k = 5 } = req.body || {};
    const safeK = Math.min(10, Math.max(1, Number(k) || 5));
    const recommendations = await recommend({ userId, genres, tags, k: safeK });
    res.json({
      recommendations,
      algorithm: {
        similarity: 'Jaccard Similarity',
        relationshipModel: 'Dynamic Weighted Graph / Adjacency List',
        topK: 'Min-Heap Priority Queue',
        lookup: 'Hash Map',
        ranking: 'Merge Sort (available for final ranking/explanation)'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/preferences', async (req, res) => {
  try {
    await savePreferences(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/interactions', async (req, res) => {
  try {
    await saveInteraction(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  try {
    await checkDatabase();
    console.log(`Recommendation Engine API running at http://localhost:${PORT}`);
    console.log('MySQL database connected.');
  } catch (error) {
    console.error(`API running at http://localhost:${PORT}, but MySQL is not connected: ${error.message}`);
    console.error('Create the database and configure backend/.env before using recommendation endpoints.');
  }
});
