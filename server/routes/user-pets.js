const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_SEX = new Set(['male', 'female', 'unknown']);

function formatDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function formatPet(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    breedId: row.breed_id,
    breed: row.breed_id
      ? {
          id: row.breed_id,
          name: row.breed_name,
          species: row.breed_species,
        }
      : null,
    name: row.name,
    birthday: formatDateOnly(row.birthday),
    sex: row.sex,
    avatarUrl: row.avatar_url || null,
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return false;
  }

  return value <= new Date().toISOString().slice(0, 10);
}

function validatePetInput(input, { partial = false } = {}) {
  const body = input && typeof input === 'object' ? input : {};
  const errors = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'breedId')) {
    if (typeof body.breedId !== 'string' || body.breedId.trim() === '') {
      errors.breedId = 'breedId 为必填项';
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      errors.name = 'name 为必填项';
    } else if (body.name.trim().length > 50) {
      errors.name = 'name 不能超过50个字符';
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'birthday') && body.birthday !== null) {
    if (!isValidDateOnly(body.birthday)) {
      errors.birthday = 'birthday 必须是有效的 YYYY-MM-DD 日期且不能晚于今天';
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'sex')) {
    if (!ALLOWED_SEX.has(body.sex)) {
      errors.sex = 'sex 只能是 male、female 或 unknown';
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl') && body.avatarUrl !== null) {
    if (typeof body.avatarUrl !== 'string' || body.avatarUrl.length > 500) {
      errors.avatarUrl = 'avatarUrl 不能超过500个字符';
    }
  }

  return {
    errors,
    values: {
      ...(Object.prototype.hasOwnProperty.call(body, 'breedId') && {
        breedId: typeof body.breedId === 'string' ? body.breedId.trim() : body.breedId,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, 'name') && {
        name: typeof body.name === 'string' ? body.name.trim() : body.name,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, 'birthday') && {
        birthday: body.birthday || null,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, 'sex') && {
        sex: body.sex,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, 'avatarUrl') && {
        avatarUrl: body.avatarUrl || null,
      }),
    },
  };
}

async function findPet(pool, userId) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.user_id, p.breed_id, p.name,
            DATE_FORMAT(p.birthday, '%Y-%m-%d') AS birthday, p.sex, p.avatar_url,
            p.is_primary, p.created_at, p.updated_at,
            b.name AS breed_name, b.species AS breed_species
     FROM user_pets p
     LEFT JOIN breeds b ON b.id = p.breed_id
     WHERE p.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function findActiveBreed(pool, breedId) {
  const [rows] = await pool.execute('SELECT * FROM breeds WHERE id = ?', [breedId]);
  const breed = rows[0];
  if (!breed || (Object.prototype.hasOwnProperty.call(breed, 'status') && breed.status !== 'active')) {
    return null;
  }
  return breed;
}

function validationError(res, errors) {
  return res.status(400).json({
    code: 1001,
    message: Object.values(errors)[0] || '请求参数不正确',
    errors,
  });
}

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pet = await findPet(req.app.locals.pool, req.user.id);
    return res.json({ code: 0, data: formatPet(pet) });
  } catch (error) {
    console.error('Get primary user pet error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/me', authMiddleware, async (req, res) => {
  const { errors, values } = validatePetInput(req.body);
  if (Object.keys(errors).length > 0) return validationError(res, errors);

  try {
    const pool = req.app.locals.pool;
    const existing = await findPet(pool, req.user.id);
    if (existing) {
      return res.status(409).json({ code: 2001, message: '主宠档案已存在' });
    }

    const breed = await findActiveBreed(pool, values.breedId);
    if (!breed) {
      return res.status(400).json({ code: 1001, message: '品种不存在或已停用' });
    }

    const petId = uuidv4();
    await pool.execute(
      `INSERT INTO user_pets
       (id, user_id, breed_id, name, birthday, sex, avatar_url, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        petId,
        req.user.id,
        values.breedId,
        values.name,
        values.birthday ?? null,
        values.sex ?? 'unknown',
        values.avatarUrl ?? null,
      ]
    );

    const pet = await findPet(pool, req.user.id);
    return res.status(201).json({ code: 0, data: formatPet(pet) });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 2001, message: '主宠档案已存在' });
    }
    console.error('Create primary user pet error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  const { errors, values } = validatePetInput(req.body, { partial: true });
  if (Object.keys(errors).length > 0) return validationError(res, errors);

  try {
    const pool = req.app.locals.pool;
    const existing = await findPet(pool, req.user.id);
    if (!existing) {
      return res.status(404).json({ code: 1004, message: '主宠档案不存在' });
    }

    if (values.breedId && values.breedId !== existing.breed_id) {
      const breed = await findActiveBreed(pool, values.breedId);
      if (!breed) {
        return res.status(400).json({ code: 1001, message: '品种不存在或已停用' });
      }
    }

    const updates = [];
    const params = [];
    const columnMap = {
      breedId: 'breed_id',
      name: 'name',
      birthday: 'birthday',
      sex: 'sex',
      avatarUrl: 'avatar_url',
    };
    for (const [field, column] of Object.entries(columnMap)) {
      if (Object.prototype.hasOwnProperty.call(values, field)) {
        updates.push(`${column} = ?`);
        params.push(values[field]);
      }
    }

    if (updates.length > 0) {
      params.push(req.user.id);
      await pool.execute(
        `UPDATE user_pets SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );
    }

    const pet = await findPet(pool, req.user.id);
    return res.json({ code: 0, data: formatPet(pet) });
  } catch (error) {
    console.error('Update primary user pet error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.delete('/me', authMiddleware, async (req, res) => {
  try {
    await req.app.locals.pool.execute('DELETE FROM user_pets WHERE user_id = ?', [req.user.id]);
    return res.json({ code: 0, data: { deleted: true } });
  } catch (error) {
    console.error('Delete primary user pet error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
module.exports.formatPet = formatPet;
module.exports.validatePetInput = validatePetInput;
