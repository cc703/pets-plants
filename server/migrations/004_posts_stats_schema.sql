-- Align posts schema with the current API contract.
-- Safe to run on databases initialized from older full_schema.sql versions.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS stats JSON COMMENT 'likesCount, commentsCount, viewsCount' AFTER tags;

UPDATE posts
SET stats = JSON_OBJECT(
  'likesCount', COALESCE(likes_count, 0),
  'commentsCount', COALESCE(comments_count, 0),
  'viewsCount', COALESCE(views_count, 0)
)
WHERE stats IS NULL;
