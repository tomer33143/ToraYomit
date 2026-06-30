const { supabase } = require('./supabase');
const { parseBody, checkApiKey, generateId, generateCode, getIsraelDate, addFeedEvent, normalizeUser, normalizeGroup } = require('./utils');

module.exports = async (req, res) => {
  if (!checkApiKey(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, password, groupName } = await parseBody(req);
    console.log('📝 create-group received:', { name, phone, groupName });
    if (!name || !phone || !password || !groupName) {
      return res.status(400).json({ error: 'כל השדות חובה' });
    }

    const { data: existingUser, error: userError } = await supabase.from('users').select('id').eq('phone', phone).single();
    if (userError && userError.code !== 'PGRST116') {
      return res.status(500).json({ error: userError.message });
    }
    if (existingUser) {
      return res.status(400).json({ error: 'מספר טלפון כבר רשום במערכת.' });
    }

    let code;
    for (let i = 0; i < 6; i++) {
      code = generateCode();
      const { data: existingGroup } = await supabase.from('groups').select('id').eq('code', code).maybeSingle();
      if (!existingGroup) break;
    }

    const groupId = generateId();
    const rabbiId = generateId();
    const today = getIsraelDate();

    const { error: groupError } = await supabase.from('groups').insert([{
      id: groupId,
      name: groupName,
      code,
      rabbi_id: rabbiId,
      bonus: 10,
      date: today
    }]);
    if (groupError) {
      console.error('❌ Group insert error:', groupError);
      return res.status(500).json({ error: groupError.message });
    }

    const { error: userInsertError } = await supabase.from('users').insert([{
      id: rabbiId,
      phone,
      password,
      name,
      role: 'rabbi',
      group_id: groupId,
      points: 0
    }]);
    if (userInsertError) {
      console.error('❌ User insert error:', userInsertError);
      return res.status(500).json({ error: userInsertError.message });
    }

    await addFeedEvent(groupId, 'system', `🎉 נפתחה קבוצת "${groupName}"! קוד ההצטרפות: ${code}`);

    const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
    console.log('📊 Group from DB:', group);
    
    const userObj = { id: rabbiId, phone, name, role: 'rabbi', group_id: groupId, points: 0 };
    console.log('👤 User object before normalize:', userObj);
    
    const normalizedUser = normalizeUser(userObj);
    console.log('👤 User after normalize:', normalizedUser);
    
    const normalizedGroup = normalizeGroup(group);
    console.log('👥 Group after normalize:', normalizedGroup);
    
    const response = { 
      user: normalizedUser, 
      group: { ...normalizedGroup, tasks: [], feed: [] } 
    };
    console.log('✅ FINAL RESPONSE:', JSON.stringify(response, null, 2));
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
