const { supabase } = require('./supabase');
const { parseBody, getIsraelDate, addFeedEvent, normalizeUser } = require('./utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, action, payload } = await parseBody(req);
    if (!userId || !action) return res.status(400).json({ error: 'Missing userId or action' });

    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(403).json({ error: 'לא מורשה' });

    const { data: group, error: groupError } = await supabase.from('groups').select('*').eq('id', user.group_id).maybeSingle();
    if (groupError) return res.status(500).json({ error: groupError.message });
    if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    if (action === 'ADD_TASK') {
      if (user.role !== 'rabbi') return res.status(403).json({ error: 'לא מורשה' });
      const { desc, points } = payload || {};
      if (!desc || !points) return res.status(400).json({ error: 'חסרים פרטים' });
      const { error: insertError } = await supabase.from('tasks').insert([{
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        group_id: group.id,
        description: desc,
        points: parseInt(points, 10)
      }]);
      if (insertError) return res.status(500).json({ error: insertError.message });
      await addFeedEvent(group.id, 'system', `📋 משימה חדשה: "${desc}" (${points} נק')`);
    } else if (action === 'REMOVE_TASK') {
      if (user.role !== 'rabbi') return res.status(403).json({ error: 'לא מורשה' });
      const { taskId } = payload || {};
      if (!taskId) return res.status(400).json({ error: 'חסרים פרטים' });
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId).eq('group_id', group.id);
      if (deleteError) return res.status(500).json({ error: deleteError.message });
    } else if (action === 'CLEAR_TASKS') {
      if (user.role !== 'rabbi') return res.status(403).json({ error: 'לא מורשה' });
      const { error: clearError } = await supabase.from('tasks').delete().eq('group_id', group.id);
      if (clearError) return res.status(500).json({ error: clearError.message });
    } else if (action === 'POST_MESSAGE') {
      if (user.role !== 'rabbi') return res.status(403).json({ error: 'לא מורשה' });
      const text = payload?.text;
      if (!text) return res.status(400).json({ error: 'הודעה ריקה' });
      await addFeedEvent(group.id, 'rabbi', text);
    } else if (action === 'UPDATE_BONUS') {
      if (user.role !== 'rabbi') return res.status(403).json({ error: 'לא מורשה' });
      const bonus = parseInt(payload?.bonus, 10) || 0;
      const { error: updateError } = await supabase.from('groups').update({ bonus }).eq('id', group.id);
      if (updateError) return res.status(500).json({ error: updateError.message });
    } else if (action === 'SUBMIT_TASKS') {
      if (user.role !== 'student') return res.status(403).json({ error: 'לא מורשה' });
      const tasksDone = Array.isArray(payload?.tasksDone) ? payload.tasksDone : [];
      const today = getIsraelDate();

      const { data: existing, error: existingError } = await supabase.from('submissions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      if (existingError) return res.status(500).json({ error: existingError.message });
      if (existing) return res.status(400).json({ error: 'כבר הגשת משימות להיום' });

      const nowInIsrael = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false
      }).format(new Date());
      if (parseInt(nowInIsrael, 10) >= 24) {
        return res.status(400).json({ error: 'הזמן להגשה עבר!' });
      }

      const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*').eq('group_id', group.id);
      if (tasksError) return res.status(500).json({ error: tasksError.message });

      let earned = 0;
      tasksDone.forEach(tid => {
        const task = tasks.find(t => t.id === tid);
        if (task) earned += task.points;
      });
      const allDone = tasksDone.length === tasks.length && tasks.length > 0;
      if (allDone) earned += group.bonus;

      const { data: prevTopData, error: prevTopError } = await supabase.from('users')
        .select('*')
        .eq('group_id', group.id)
        .eq('role', 'student')
        .order('points', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevTopError) return res.status(500).json({ error: prevTopError.message });

      const { error: updateError } = await supabase.from('users').update({ points: user.points + earned }).eq('id', user.id);
      if (updateError) return res.status(500).json({ error: updateError.message });

      const { error: submitError } = await supabase.from('submissions').insert([{
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        group_id: group.id,
        user_id: user.id,
        date: today,
        tasks_done: JSON.stringify(tasksDone),
        submitted: true,
        points_earned: earned
      }]);
      if (submitError) return res.status(500).json({ error: submitError.message });

      const { data: newTopData, error: newTopError } = await supabase.from('users')
        .select('*')
        .eq('group_id', group.id)
        .eq('role', 'student')
        .order('points', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (newTopError) return res.status(500).json({ error: newTopError.message });

      if (newTopData && prevTopData && newTopData.id !== prevTopData.id) {
        await addFeedEvent(group.id, 'system', `🏆 מהפך בפסגה! ${newTopData.name} עלה/ה למקום הראשון!`);
      }

      const doneCount = tasksDone.length;
      const total = tasks.length;
      if (allDone) {
        await addFeedEvent(group.id, 'system', `⭐ ${user.name} סיים/ה את כל ${total} המשימות וקיבל/ה ${earned} נק' (כולל בונוס)!`);
      } else {
        await addFeedEvent(group.id, 'system', `✅ ${user.name} סיים/ה ${doneCount}/${total} משימות וצבר/ה ${earned} נק'.`);
      }
    } else {
      return res.status(400).json({ error: 'פעולה לא מוכרת' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
