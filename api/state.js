const { supabase } = require('./supabase');
const { parseBody, getIsraelDate, addFeedEvent, normalizeUser, normalizeGroup, normalizeTask, normalizeFeed, normalizeSubmission } = require('./utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await parseBody(req);
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

    const { data: group, error: groupError } = await supabase.from('groups').select('*').eq('id', user.group_id).maybeSingle();
    if (groupError) return res.status(500).json({ error: groupError.message });
    if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    const today = getIsraelDate();
    if (group.date !== today) {
      const { error: updateError } = await supabase.from('groups').update({ date: today }).eq('id', group.id);
      if (updateError) return res.status(500).json({ error: updateError.message });

      const { error: deleteError } = await supabase.from('tasks').delete().eq('group_id', group.id);
      if (deleteError) return res.status(500).json({ error: deleteError.message });

      await addFeedEvent(group.id, 'system', '📅 יום חדש התחיל! הרב יעלה משימות חדשות.');
      group.date = today;
    }

    const [{ data: tasks, error: tasksError }, { data: feed, error: feedError }, { data: users, error: usersError }, { data: submissions, error: submissionsError }] = await Promise.all([
      supabase.from('tasks').select('id, description, points').eq('group_id', group.id),
      supabase.from('feed').select('*').eq('group_id', group.id).order('time', { ascending: false }).limit(50),
      supabase.from('users').select('*').eq('group_id', group.id),
      supabase.from('submissions').select('*').eq('group_id', group.id).eq('date', today)
    ]);

    if (tasksError || feedError || usersError || submissionsError) {
      const error = tasksError || feedError || usersError || submissionsError;
      return res.status(500).json({ error: error.message });
    }

    const groupUsers = users.map(normalizeUser);
    const submissionsByDate = submissions.reduce((acc, row) => {
      const normalized = normalizeSubmission(row);
      if (!acc[row.date]) acc[row.date] = {};
      acc[row.date][row.user_id] = normalized;
      return acc;
    }, {});

    return res.status(200).json({
      user: normalizeUser(user),
      group: { ...normalizeGroup(group), tasks: tasks.map(normalizeTask), feed: feed.map(normalizeFeed) },
      users: groupUsers,
      submissions: submissionsByDate
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
