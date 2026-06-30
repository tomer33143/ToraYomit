const { supabase } = require('./supabase');
const { parseBody, generateId, addFeedEvent, normalizeUser, normalizeGroup } = require('./utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, password, code } = await parseBody(req);
    if (!name || !phone || !password || !code) {
      return res.status(400).json({ error: 'כל השדות חובה' });
    }

    const { data: existingUser, error: userError } = await supabase.from('users').select('id').eq('phone', phone).single();
    if (userError && userError.code !== 'PGRST116') {
      return res.status(500).json({ error: userError.message });
    }
    if (existingUser) {
      return res.status(400).json({ error: 'מספר טלפון כבר רשום. לחץ על התחברות.' });
    }

    const upperCode = code.toUpperCase();
    const { data: group, error: groupError } = await supabase.from('groups').select('*').eq('code', upperCode).maybeSingle();
    if (groupError) return res.status(500).json({ error: groupError.message });
    if (!group) return res.status(404).json({ error: 'קוד קבוצה שגוי' });

    const studentId = generateId();
    const { error: insertError } = await supabase.from('users').insert([{
      id: studentId,
      phone,
      password,
      name,
      role: 'student',
      group_id: group.id,
      points: 0
    }]);
    if (insertError) return res.status(500).json({ error: insertError.message });

    await addFeedEvent(group.id, 'system', `👤 ${name} הצטרף/ה לקבוצה!`);
    return res.status(200).json({ user: normalizeUser({ id: studentId, phone, name, role: 'student', group_id: group.id, points: 0 }), group: { ...normalizeGroup(group), tasks: [], feed: [] } });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
