const { supabase } = require('./supabase');
const { parseBody, normalizeUser, normalizeGroup } = require('./utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, password } = await parseBody(req);
    if (!phone || !password) {
      return res.status(400).json({ error: 'טלפון וסיסמא חובה' });
    }

    const { data: user, error: userError } = await supabase.from('users').select('*').eq('phone', phone).eq('password', password).maybeSingle();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(401).json({ error: 'טלפון או סיסמא שגויים' });

    const { data: group, error: groupError } = await supabase.from('groups').select('*').eq('id', user.group_id).maybeSingle();
    if (groupError) return res.status(500).json({ error: groupError.message });
    if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    return res.status(200).json({ user: normalizeUser(user), group: { ...normalizeGroup(group), tasks: [], feed: [] } });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
