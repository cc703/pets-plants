const { v4: uuidv4 } = require('uuid');

async function createNotification(connection, {
  userId,
  fromUserId = null,
  type,
  targetType = null,
  targetId = null,
  content,
}) {
  if (!userId || !type || !content) return;
  if (fromUserId && userId === fromUserId) return;

  await connection.execute(
    `INSERT INTO notifications
      (id, user_id, from_user_id, type, target_type, target_id, content, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [uuidv4(), userId, fromUserId, type, targetType, targetId, content],
  );
}

module.exports = { createNotification };
