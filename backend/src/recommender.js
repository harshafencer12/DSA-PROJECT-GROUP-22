
const { pool } = require('./db');

// -----------------------------
// DSA primitives
// -----------------------------

// Normalize titles for consistent sorting and searching.
// Removes leading punctuation and diacritics while preserving the original title.
function normalizeTitleKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

// Sort titles alphabetically using normalized keys.
// Original titles in MySQL are never modified.
function compareTitles(a, b) {
  const first = normalizeTitleKey(a.title);
  const second = normalizeTitleKey(b.title);

  if (first < second) return -1;
  if (first > second) return 1;

  // Stable tie-breaker for titles with equivalent normalized forms.
  return String(a.title || '').localeCompare(String(b.title || ''), 'en') ||
    Number(a.id) - Number(b.id);
}

// Hash Map: O(1) average lookup by movie id.
function buildMovieMap(rows) {
  return new Map(rows.map(movie => [movie.id, movie]));
}

// Jaccard similarity: |A ∩ B| / |A ∪ B|
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const union = new Set([...A, ...B]);

  if (!union.size) return 0;

  let common = 0;
  for (const value of A) {
    if (B.has(value)) common++;
  }

  return common / union.size;
}

// Binary search over records sorted by normalized title.
function binarySearchTitle(sortedMovies, query) {
  const q = normalizeTitleKey(query);
  let lo = 0;
  let hi = sortedMovies.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const title = normalizeTitleKey(
      sortedMovies[mid].title_sort || sortedMovies[mid].title
    );

    if (title === q) return sortedMovies[mid];
    if (title < q) lo = mid + 1;
    else hi = mid - 1;
  }

  return null;
}

// Merge sort for deterministic ranking demonstration.
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const result = [];

  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i].score >= right[j].score) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }

  return result.concat(left.slice(i), right.slice(j));
}

// Min-heap: keeps only Top-K candidates, O(n log k).
class MinHeap {
  constructor() {
    this.data = [];
  }

  size() {
    return this.data.length;
  }

  push(value) {
    this.data.push(value);
    let i = this.data.length - 1;

    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);

      if (this.data[parent].score <= this.data[i].score) break;

      [this.data[parent], this.data[i]] =
        [this.data[i], this.data[parent]];

      i = parent;
    }
  }

  pop() {
    if (!this.data.length) return null;

    const root = this.data[0];
    const last = this.data.pop();

    if (this.data.length) {
      this.data[0] = last;
      let i = 0;

      while (true) {
        let smallest = i;
        const left = i * 2 + 1;
        const right = i * 2 + 2;

        if (
          left < this.data.length &&
          this.data[left].score < this.data[smallest].score
        ) {
          smallest = left;
        }

        if (
          right < this.data.length &&
          this.data[right].score < this.data[smallest].score
        ) {
          smallest = right;
        }

        if (smallest === i) break;

        [this.data[i], this.data[smallest]] =
          [this.data[smallest], this.data[i]];

        i = smallest;
      }
    }

    return root;
  }
}

function splitGenres(value) {
  return String(value || '')
    .split('|')
    .map(value => value.trim())
    .filter(Boolean);
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

// -----------------------------
// Users
// -----------------------------

async function getUsers() {
  const [users] = await pool.query(`
    SELECT
      u.id,
      u.name,
      COALESCE(p.genres, '') AS genres,
      COALESCE(p.tags, '') AS tags
    FROM app_users u
    LEFT JOIN user_preferences p ON p.user_id = u.id
    ORDER BY u.id
  `);

  for (const user of users) {
    const [liked] = await pool.query(`
      SELECT m.id, m.title
      FROM interactions i
      JOIN movies m ON m.id = i.movie_id
      WHERE i.user_id = ?
        AND (
          i.interaction_type = 'like'
          OR (
            i.interaction_type = 'rating'
            AND i.rating >= 4
          )
        )
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [user.id]);

    user.likedItems = liked.map(item => item.title);
    user.genres = splitList(user.genres);
    user.tags = splitList(user.tags);
  }

  return users;
}

// -----------------------------
// Movie catalogue
// -----------------------------

async function getItems({
  q = '',
  limit = 50,
  offset = 0
} = {}) {
  const safeLimit = Math.min(
    100,
    Math.max(1, Math.trunc(Number(limit) || 50))
  );

  const safeOffset = Math.max(
    0,
    Math.trunc(Number(offset) || 0)
  );

  const query = String(q || '').trim();
  const params = [];
  let where = '';

  if (query) {
    where = `WHERE title_sort LIKE ? OR genres LIKE ?`;
    const needle = `%${query}%`;
    params.push(needle, needle);
  }

  // Ignore leading punctuation for the primary alphabetical ordering.
  // The original movie titles are returned unchanged.
  const [rows] = await pool.query(`
    SELECT
      id,
      title,
      title_sort,
      release_year,
      genres,
      imdb_id,
      tmdb_id
    FROM movies
    ${where}
    ORDER BY
      REGEXP_REPLACE(
        COALESCE(title_sort, title),
        '^[^[:alnum:]]+',
        ''
      ) COLLATE utf8mb4_0900_ai_ci ASC,
      title COLLATE utf8mb4_0900_ai_ci ASC,
      id ASC
    LIMIT ? OFFSET ?
  `, [...params, safeLimit, safeOffset]);

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    type: 'Movie',
    year: row.release_year,
    genres: splitGenres(row.genres),
    tags: [],
    rating: null,
    popularity: null,
    imdbId: row.imdb_id,
    tmdbId: row.tmdb_id
  }));
}

// -----------------------------
// Genres and statistics
// -----------------------------

async function getGenres() {
  const [rows] = await pool.query('SELECT genres FROM movies');
  const set = new Set();

  for (const row of rows) {
    splitGenres(row.genres).forEach(genre => {
      if (genre !== '(no genres listed)') set.add(genre);
    });
  }

  return [...set].sort((a, b) => a.localeCompare(b));
}

async function getStats() {
  const [[movies]] = await pool.query(
    'SELECT COUNT(*) AS count FROM movies'
  );

  const [[users]] = await pool.query(
    'SELECT COUNT(*) AS count FROM app_users'
  );

  const [[interactions]] = await pool.query(
    'SELECT COUNT(*) AS count FROM interactions'
  );

  const [genreRows] = await pool.query(
    'SELECT genres FROM movies'
  );

  const genreSet = new Set();

  for (const row of genreRows) {
    splitGenres(row.genres).forEach(genre => genreSet.add(genre));
  }

  return {
    users: Number(users.count),
    items: Number(movies.count),
    interactions: Number(interactions.count),
    graphNodes: Number(movies.count),
    graphEdges: 'dynamic',
    genres: genreSet.size
  };
}

// -----------------------------
// User profile and graph
// -----------------------------

async function getProfile(userId, extraGenres = [], extraTags = []) {
  const [[user]] = await pool.query(`
    SELECT
      u.id,
      u.name,
      COALESCE(p.genres, '') AS genres,
      COALESCE(p.tags, '') AS tags
    FROM app_users u
    LEFT JOIN user_preferences p ON p.user_id = u.id
    WHERE u.id = ?
  `, [Number(userId)]);

  const profileGenres = new Set([
    ...(user ? splitList(user.genres) : []),
    ...extraGenres
  ]);

  const profileTags = new Set([
    ...(user ? splitList(user.tags) : []),
    ...extraTags
  ]);

  const [liked] = await pool.query(`
    SELECT m.id, m.title, m.genres
    FROM interactions i
    JOIN movies m ON m.id = i.movie_id
    WHERE i.user_id = ?
      AND (
        i.interaction_type = 'like'
        OR (
          i.interaction_type = 'rating'
          AND i.rating >= 4
        )
      )
  `, [Number(userId)]);

  for (const movie of liked) {
    splitGenres(movie.genres).forEach(genre => {
      profileGenres.add(genre);
    });
  }

  return {
    user: user || {
      id: Number(userId),
      name: `User ${userId}`
    },
    liked,
    genres: [...profileGenres],
    tags: [...profileTags]
  };
}

// Dynamic weighted graph using shared movie genres.
async function buildRelevantGraph(likedMovies) {
  const graphWeights = new Map();

  for (const liked of likedMovies) {
    const genres = splitGenres(liked.genres)
      .filter(genre => genre !== '(no genres listed)');

    if (!genres.length) continue;

    const conditions = genres
      .map(() => "CONCAT('|', genres, '|') LIKE CONCAT('%|', ?, '|%')")
      .join(' OR ');

    const [rows] = await pool.query(`
      SELECT id, genres
      FROM movies
      WHERE id <> ?
        AND (${conditions})
    `, [liked.id, ...genres]);

    for (const row of rows) {
      const common = splitGenres(row.genres)
        .filter(genre => genres.includes(genre)).length;

      if (common) {
        graphWeights.set(
          row.id,
          (graphWeights.get(row.id) || 0) + common * 3
        );
      }
    }
  }

  return graphWeights;
}

// -----------------------------
// Recommendation engine
// -----------------------------

async function recommend({
  userId = 1,
  genres = [],
  tags = [],
  k = 5
}) {
  const profile = await getProfile(userId, genres, tags);
  const likedIds = new Set(profile.liked.map(movie => movie.id));
  const graphWeights = await buildRelevantGraph(profile.liked);

  const [rows] = await pool.query(`
    SELECT
      m.id,
      m.title,
      m.release_year,
      m.genres,
      COALESCE(s.avg_rating, 0) AS avg_rating,
      COALESCE(s.rating_count, 0) AS rating_count
    FROM movies m
    LEFT JOIN movie_stats s ON s.movie_id = m.id
  `);

  const safeK = Math.min(10, Math.max(1, Number(k) || 5));
  const heap = new MinHeap();

  for (const row of rows) {
    if (likedIds.has(row.id)) continue;

    const movieGenres = splitGenres(row.genres);
    const genreSim = jaccard(profile.genres, movieGenres);
    const graphScore = graphWeights.get(row.id) || 0;
    const rating = Number(row.avg_rating || 0) / 5;
    const popularity = Math.min(
      1,
      Math.log10(Number(row.rating_count || 0) + 1) / 4
    );

    const score =
      genreSim * 55 +
      Math.min(graphScore / 18, 1) * 20 +
      rating * 20 +
      popularity * 5;

    heap.push({
      id: row.id,
      title: row.title,
      type: 'Movie',
      year: row.release_year,
      genres: movieGenres,
      tags: [],
      rating: Number(Number(row.avg_rating || 0).toFixed(1)),
      popularity: Math.round(popularity * 100),
      score,
      breakdown: {
        genreSimilarity: genreSim,
        graphScore,
        rating,
        popularity
      }
    });

    if (heap.size() > safeK) heap.pop();
  }

  const result = [];

  while (heap.size()) {
    result.push(heap.pop());
  }

  result.reverse();

  return result.map((entry, index) => ({
    rank: index + 1,
    ...entry,
    score: Number(entry.score.toFixed(2)),
    matchPercent: Math.min(
      99,
      Math.max(1, Math.round(entry.score))
    ),
    explanation: explain(entry.breakdown, profile, entry)
  }));
}

function explain(breakdown, profile, item) {
  const commonGenres = splitGenres(item.genres)
    .filter(genre => profile.genres.includes(genre)).length;

  const reasons = [];

  if (commonGenres) {
    reasons.push(
      `${commonGenres} matching genre${commonGenres > 1 ? 's' : ''}`
    );
  }

  if (breakdown.graphScore) {
    reasons.push('a strong edge in the relevant movie graph');
  }

  if (breakdown.rating) {
    reasons.push('rating signal from the dataset');
  }

  if (!reasons.length) {
    reasons.push('the available preference signals');
  }

  return `Recommended because of ${reasons.join(', ')}.`;
}

// -----------------------------
// Movie search
// -----------------------------

async function searchMovies(query) {
  const q = String(query || '').trim();

  if (!q) {
    return {
      algorithm: 'Binary Search + normalized title matching',
      result: null,
      matches: []
    };
  }

  // Fetch title fields and sort in JavaScript by the same normalized key
  // used by binary search. This keeps the search ordering consistent.
  const [rows] = await pool.query(`
    SELECT id, title, title_sort, release_year, genres
    FROM movies
  `);

  const sorted = rows.sort((a, b) => {
    const first = normalizeTitleKey(a.title_sort || a.title);
    const second = normalizeTitleKey(b.title_sort || b.title);

    if (first < second) return -1;
    if (first > second) return 1;

    return Number(a.id) - Number(b.id);
  });

  const normalizedQuery = normalizeTitleKey(q);
  const exact = binarySearchTitle(sorted, q);

  // Search normalized titles, so punctuation and diacritics do not
  // prevent a useful match.
  const matches = sorted
    .filter(movie => {
      const titleKey = normalizeTitleKey(
        movie.title_sort || movie.title
      );

      return titleKey.includes(normalizedQuery);
    })
    .slice(0, 30)
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      type: 'Movie',
      year: movie.release_year,
      genres: splitGenres(movie.genres),
      tags: [],
      rating: null,
      popularity: null
    }));

  return {
    algorithm: 'Binary Search + normalized title matching',
    result: exact
      ? {
          id: exact.id,
          title: exact.title,
          type: 'Movie'
        }
      : null,
    matches
  };
}

// -----------------------------
// Movie relationship graph
// -----------------------------

async function getGraph(id) {
  const [[movie]] = await pool.query(
    'SELECT id, title, genres FROM movies WHERE id = ?',
    [Number(id)]
  );

  if (!movie) return null;

  const genres = splitGenres(movie.genres)
    .filter(genre => genre !== '(no genres listed)');

  if (!genres.length) {
    return {
      itemId: movie.id,
      title: movie.title,
      connections: []
    };
  }

  const conditions = genres
    .map(() => "CONCAT('|', genres, '|') LIKE CONCAT('%|', ?, '|%')")
    .join(' OR ');

  const [rows] = await pool.query(`
    SELECT id, title, genres
    FROM movies
    WHERE id <> ?
      AND (${conditions})
    LIMIT 25
  `, [movie.id, ...genres]);

  return {
    itemId: movie.id,
    title: movie.title,
    connections: rows.map(row => ({
      id: row.id,
      title: row.title,
      weight: splitGenres(row.genres)
        .filter(genre => genres.includes(genre)).length * 3
    }))
  };
}

// -----------------------------
// Persist interactions/preferences
// -----------------------------

async function saveInteraction({
  userId,
  movieId,
  interactionType,
  rating
}) {
  await pool.query(`
    INSERT INTO interactions
      (user_id, movie_id, interaction_type, rating)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      rating = VALUES(rating),
      created_at = CURRENT_TIMESTAMP
  `, [
    Number(userId),
    Number(movieId),
    interactionType,
    rating == null ? null : Number(rating)
  ]);
}

async function savePreferences({ userId, genres, tags }) {
  await pool.query(`
    INSERT INTO user_preferences (user_id, genres, tags)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      genres = VALUES(genres),
      tags = VALUES(tags)
  `, [
    Number(userId),
    (genres || []).join(','),
    (tags || []).join(',')
  ]);
}

module.exports = {
  getItems,
  getUsers,
  getStats,
  getGenres,
  recommend,
  searchMovies,
  getGraph,
  saveInteraction,
  savePreferences,
  buildMovieMap,
  mergeSort
};
