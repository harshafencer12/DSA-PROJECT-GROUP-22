const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { pool } = require('../src/db');

const DATA_DIR = process.env.MOVIELENS_DIR || path.resolve(__dirname, '../../data/ml-32m');
const RATINGS = path.join(DATA_DIR, 'ratings.csv');
const BATCH_SIZE = 1000;

async function main() {
  if (!fs.existsSync(RATINGS)) throw new Error(`Missing ${RATINGS}`);
  console.log(`Aggregating ratings from: ${RATINGS}`);
  const stats = new Map();
  let processed = 0;
  const parser = fs.createReadStream(RATINGS).pipe(parse({ columns: true, skip_empty_lines: true }));

  for await (const row of parser) {
    const movieId = Number(row.movieId);
    const rating = Number(row.rating);
    const current = stats.get(movieId) || { sum: 0, count: 0 };
    current.sum += rating;
    current.count += 1;
    stats.set(movieId, current);
    processed++;
    if (processed % 500000 === 0) process.stdout.write(`\\rProcessed ${processed.toLocaleString()} ratings`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('TRUNCATE TABLE movie_stats');
    let batch = [];
    for (const [movieId, value] of stats) {
      batch.push([movieId, Number((value.sum / value.count).toFixed(2)), value.count]);
      if (batch.length >= BATCH_SIZE) {
        await conn.query(`INSERT INTO movie_stats (movie_id,avg_rating,rating_count) VALUES ?`, [batch]);
        batch = [];
      }
    }
    if (batch.length) await conn.query(`INSERT INTO movie_stats (movie_id,avg_rating,rating_count) VALUES ?`, [batch]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
  console.log(`\\nRating summary complete for ${stats.size.toLocaleString()} movies from ${processed.toLocaleString()} ratings.`);
}

main().catch(err => {
  console.error('Rating aggregation failed:', err.message);
  process.exit(1);
});
