const { supabase } = require('./supabase');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method !== 'POST') {
      return resolve({});
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function checkApiKey(req, res) {
  const expectedKey = process.env.API_KEY;
  if (!expectedKey) {
    return true;
  }

  const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  if (key !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getIsraelDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

async function addFeedEvent(groupId, type, text) {
  const { error } = await supabase.from('feed').insert([{ group_id: groupId, type, text, time: new Date().toISOString() }]);
  if (error) throw error;
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    role: row.role,
    groupId: row.group_id,
    points: row.points
  };
}

function normalizeGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    rabbiId: row.rabbi_id,
    meta: {
      bonus: row.bonus,
      date: row.date
    }
  };
}

function normalizeTask(row) {
  if (!row) return null;
  return { id: row.id, desc: row.description, points: row.points };
}

function normalizeFeed(row) {
  if (!row) return null;
  return { id: row.id, type: row.type, text: row.text, time: row.time };
}

function normalizeSubmission(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    tasksDone: asArray(row.tasks_done),
    submitted: row.submitted,
    pointsEarned: row.points_earned
  };
}

module.exports = {
  parseBody,
  checkApiKey,
  generateId,
  generateCode,
  getIsraelDate,
  addFeedEvent,
  normalizeUser,
  normalizeGroup,
  normalizeTask,
  normalizeFeed,
  normalizeSubmission
};
