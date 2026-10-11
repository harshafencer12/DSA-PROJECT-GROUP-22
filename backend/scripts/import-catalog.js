const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { pool } = require('../src/db');

const DATA_DIR = process.env.MOVIELENS_DIR || path.resolve(__dirname, '../../data/ml-32m');
const MOVIES = path.join(DATA_DIR, 'movies.csv');
const LINKS = path.join(DATA_DIR, 'links.csv');
const BATCH_SIZE = 1000;

function streamCsv(file) {
  return fs.createReadStream(file).pipe(parse({ columns: true, skip_empty_lines: true }));
}

async function readLinks() {
  if (!fs.existsSync(LINKS)) throw new Error(`Missing ${LINKS}`);
  const links = new Map();
  for await (const row of streamCsv(LINKS)) {
    links.set(Number(row.movieId), {
      imdbId: row.imdbId || null,
      tmdbId: row.tmdbId ? Number(row.tmdbId) : null
    });
  }
  return links;
}

function parseTitle(title) {
  const match = title.match(/\((\d{4})\)\s*$/);
  return {
    title: match ? title.slice(0, match.index).trim() : title,
    year: match ? Number(match[1]) : null
  };
}

async function main() {
  if (!fs.existsSync(MOVIES)) throw new Error(`Missing ${MOVIES}`);
  console.log(`Reading MovieLens catalog from: ${DATA_DIR}`);
  const links = await readLinks();
  console.log(`Loaded ${links.size.toLocaleString()} external IDs.`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE movie_tags');
    await conn.query('TRUNCATE TABLE movie_stats');
    await conn.query('TRUNCATE TABLE interactions');
    await conn.query('TRUNCATE TABLE movies');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    let batch = [];
    let count = 0;
    for await (const row of streamCsv(MOVIES)) {
      const id = Number(row.movieId);
      const parsed = parseTitle(row.title);
      const link = links.get(id) || {};
      const genres = row.genres || '(no genres listed)';
      batch.push([
        id,
        parsed.title,
        parsed.year,
        genres,
        link.imdbId || null,
        link.tmdbId || null,
        parsed.title.toLowerCase()
      ]);
      if (batch.length >= BATCH_SIZE) {
        await conn.query(
          `INSERT INTO movies (id,title,release_year,genres,imdb_id,tmdb_id,title_sort)
           VALUES ?`, [batch]
        );
        count += batch.length;
        process.stdout.write(`\\rImported ${count.toLocaleString()} movies`);
        batch = [];
      }
    }
    if (batch.length) {
      await conn.query(
        `INSERT INTO movies (id,title,release_year,genres,imdb_id,tmdb_id,title_sort)
         VALUES ?`, [batch]
      );
      count += batch.length;
    }
    await conn.commit();
    console.log(`\\nCatalog import complete: ${count.toLocaleString()} movies.`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Catalog import failed:', err.message);
  process.exit(1);
});
