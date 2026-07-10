-- This file is intentionally NOT executed by the app or server.
-- It documents safe inspection queries for cleaning historical smoke data manually.

-- Inspect suspicious users created during smoke tests
SELECT id, username, nickname, created_at
FROM users
WHERE username REGEXP '^(probe_|flow|compat_|cm|cc|cl|fa|fb|fw|ci|bm|px|ep|cp|st|utf8|ga|gb|bk|uf|cy)'
   OR nickname LIKE '%?%';

-- Inspect suspicious posts/comments with placeholder content
SELECT id, content, created_at
FROM posts
WHERE content LIKE '%?%';

SELECT id, content, created_at
FROM comments
WHERE content LIKE '%?%';

-- Inspect manually inserted circles or malformed names
SELECT id, name, created_at
FROM circles
WHERE id LIKE 'manual_%'
   OR name LIKE '%?%';

-- Optional cleanup examples: run only after review
-- DELETE FROM comments WHERE content LIKE '%?%';
-- DELETE FROM posts WHERE content LIKE '%?%';
-- DELETE FROM users WHERE username REGEXP '^(probe_|flow|compat_|cm|cc|cl|fa|fb|fw|ci|bm|px|ep|cp|st|utf8|ga|gb|bk|uf|cy)';
-- DELETE FROM circles WHERE id LIKE 'manual_%';
