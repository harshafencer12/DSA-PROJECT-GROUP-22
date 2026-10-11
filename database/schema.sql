CREATE DATABASE IF NOT EXISTS recomgraph
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE recomgraph;

CREATE TABLE IF NOT EXISTS movies (
  id INT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  release_year SMALLINT NULL,
  genres VARCHAR(500) NOT NULL,
  imdb_id VARCHAR(20) NULL,
  tmdb_id INT NULL,
  title_sort VARCHAR(500) NOT NULL,
  INDEX idx_title_sort (title_sort),
  INDEX idx_year (release_year)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT PRIMARY KEY,
  genres VARCHAR(1000) NOT NULL DEFAULT '',
  tags VARCHAR(2000) NOT NULL DEFAULT '',
  CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  movie_id INT NOT NULL,
  interaction_type ENUM('like','dislike','watch','rating') NOT NULL,
  rating DECIMAL(2,1) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_movie_interaction (user_id, movie_id, interaction_type),
  INDEX idx_interactions_user (user_id),
  INDEX idx_interactions_movie (movie_id),
  CONSTRAINT fk_interactions_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_interactions_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movie_stats (
  movie_id INT PRIMARY KEY,
  avg_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  INDEX idx_rating_count (rating_count),
  CONSTRAINT fk_movie_stats_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movie_tags (
  movie_id INT NOT NULL,
  tag VARCHAR(255) NOT NULL,
  PRIMARY KEY (movie_id, tag),
  INDEX idx_tag (tag),
  CONSTRAINT fk_movie_tags_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO app_users (id, name) VALUES
  (1, 'Harsha'),
  (2, 'Salman'),
  (3, 'Aarav')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO user_preferences (user_id, genres, tags) VALUES
  (1, 'Sci-Fi,Technology,Programming', 'space,science,coding,engineering'),
  (2, 'Action,Thriller,Adventure', 'hero,crime,aviation,competition'),
  (3, 'Drama,Comedy,Animation', 'emotional,funny,story,friendship')
ON DUPLICATE KEY UPDATE genres = VALUES(genres), tags = VALUES(tags);
