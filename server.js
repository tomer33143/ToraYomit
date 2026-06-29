const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

let data = { groups: {}, users: {}, submissions: {} };

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (raw.users) data = raw;
        }
    } catch (e) { console.error('Load error:', e); }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

loadData();

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
}
function generateCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function addFeedEvent(groupId, type, text) {
    if (!data.groups[groupId]) return;
    data.groups[groupId].feed.unshift({
        id: generateId(), type, text, time: new Date().toISOString()
    });
    // Keep feed max 50 entries
    if (data.groups[groupId].feed.length > 50) {
        data.groups[groupId].feed = data.groups[groupId].feed.slice(0, 50);
    }
}

function getIsraelDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

// 1. Create Group
app.post('/api/create-group', (req, res) => {
    const { name, phone, password, groupName } = req.body;
    if (!name || !phone || !password || !groupName) {
        return res.status(400).json({ error: 'כל השדות חובה' });
    }
    const existingUser = Object.values(data.users).find(u => u.phone === phone);
    if (existingUser) return res.status(400).json({ error: 'מספר טלפון כבר רשום במערכת.' });

    const rabbiId = generateId();
    const code = generateCode();
    const groupId = generateId();

    data.users[rabbiId] = { id: rabbiId, phone, password, name, role: 'rabbi', groupId, points: 0 };
    data.groups[groupId] = {
        id: groupId, name: groupName, code, rabbiId,
        tasks: [],
        meta: { bonus: 10, date: getIsraelDate() },
        feed: []
    };
    addFeedEvent(groupId, 'system', `🎉 נפתחה קבוצת "${groupName}"! קוד ההצטרפות: ${code}`);
    saveData();
    res.json({ user: data.users[rabbiId], group: data.groups[groupId] });
});

// 2. Join Group
app.post('/api/join-group', (req, res) => {
    const { name, phone, password, code } = req.body;
    if (!name || !phone || !password || !code) {
        return res.status(400).json({ error: 'כל השדות חובה' });
    }
    const existingUser = Object.values(data.users).find(u => u.phone === phone);
    if (existingUser) return res.status(400).json({ error: 'מספר טלפון כבר רשום. לחץ על התחברות.' });

    const group = Object.values(data.groups).find(g => g.code === code.toUpperCase());
    if (!group) return res.status(404).json({ error: 'קוד קבוצה שגוי' });

    const studentId = generateId();
    data.users[studentId] = { id: studentId, phone, password, name, role: 'student', groupId: group.id, points: 0 };
    addFeedEvent(group.id, 'system', `👤 ${name} הצטרף/ה לקבוצה!`);
    saveData();
    res.json({ user: data.users[studentId], group });
});

// 3. Login
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    const user = Object.values(data.users).find(u => u.phone === phone && u.password === password);
    if (!user) return res.status(401).json({ error: 'טלפון או סיסמא שגויים' });
    res.json({ user, group: data.groups[user.groupId] });
});

// 4. Get Full State
app.post('/api/state', (req, res) => {
    const { userId } = req.body;
    const user = data.users[userId];
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

    const group = data.groups[user.groupId];
    if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    // Check and reset if new day
    const today = getIsraelDate();
    if (group.meta.date !== today) {
        group.meta.date = today;
        group.tasks = []; // Rabbi must set new tasks each day
        addFeedEvent(group.id, 'system', `📅 יום חדש התחיל! הרב יעלה משימות חדשות.`);
        saveData();
    }

    const groupUsers = Object.values(data.users)
        .filter(u => u.groupId === group.id)
        .map(u => ({ id: u.id, name: u.name || 'ללא שם', role: u.role, points: u.points }));

    const submissions = data.submissions[group.id] || {};
    res.json({ user, group, users: groupUsers, submissions });
});

// 5. Actions
app.post('/api/action', (req, res) => {
    const { userId, action, payload } = req.body;
    const user = data.users[userId];
    if (!user) return res.status(403).json({ error: 'לא מורשה' });
    const group = data.groups[user.groupId];

    if (action === 'ADD_TASK' && user.role === 'rabbi') {
        const { desc, points } = payload;
        if (!desc || !points) return res.status(400).json({ error: 'חסרים פרטים' });
        group.tasks.push({ id: generateId(), desc, points: parseInt(points) });
        addFeedEvent(group.id, 'system', `📋 משימה חדשה: "${desc}" (${points} נק')`);
        saveData();
    }
    else if (action === 'REMOVE_TASK' && user.role === 'rabbi') {
        group.tasks = group.tasks.filter(t => t.id !== payload.taskId);
        saveData();
    }
    else if (action === 'CLEAR_TASKS' && user.role === 'rabbi') {
        group.tasks = [];
        saveData();
    }
    else if (action === 'POST_MESSAGE' && user.role === 'rabbi') {
        if (!payload.text) return res.status(400).json({ error: 'הודעה ריקה' });
        addFeedEvent(group.id, 'rabbi', payload.text);
        saveData();
    }
    else if (action === 'UPDATE_BONUS' && user.role === 'rabbi') {
        group.meta.bonus = parseInt(payload.bonus) || 0;
        saveData();
    }
    else if (action === 'SUBMIT_TASKS' && user.role === 'student') {
        const { tasksDone, date } = payload;
        const today = getIsraelDate();

        // Check if already submitted today
        if (data.submissions[group.id]?.[today]?.[userId]?.submitted) {
            return res.status(400).json({ error: 'כבר הגשת משימות להיום' });
        }

        // Check deadline (12:00 Israel time)
        const nowInIsrael = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false
        }).format(new Date());
        if (parseInt(nowInIsrael) >= 24) {
            return res.status(400).json({ error: 'הזמן להגשה עבר!' });
        }

        let earned = 0;
        tasksDone.forEach(tid => {
            const t = group.tasks.find(x => x.id === tid);
            if (t) earned += t.points;
        });
        const allDone = tasksDone.length === group.tasks.length && group.tasks.length > 0;
        if (allDone) earned += group.meta.bonus;

        // Check for leaderboard change
        const studentUsers = Object.values(data.users).filter(u => u.groupId === group.id && u.role === 'student');
        const prevTop = [...studentUsers].sort((a, b) => b.points - a.points)[0];

        user.points += earned;

        if (!data.submissions[group.id]) data.submissions[group.id] = {};
        if (!data.submissions[group.id][today]) data.submissions[group.id][today] = {};
        data.submissions[group.id][today][userId] = { tasksDone, submitted: true, pointsEarned: earned };

        const newStudentUsers = Object.values(data.users).filter(u => u.groupId === group.id && u.role === 'student');
        const newTop = [...newStudentUsers].sort((a, b) => b.points - a.points)[0];

        if (newTop && prevTop && newTop.id !== prevTop.id) {
            addFeedEvent(group.id, 'system', `🏆 מהפך בפסגה! ${newTop.name} עלה/ה למקום הראשון!`);
        }

        const doneCount = tasksDone.length;
        const total = group.tasks.length;
        if (allDone) {
            addFeedEvent(group.id, 'system', `⭐ ${user.name} סיים/ה את כל ${total} המשימות וקיבל/ה ${earned} נק' (כולל בונוס)!`);
        } else {
            addFeedEvent(group.id, 'system', `✅ ${user.name} סיים/ה ${doneCount}/${total} משימות וצבר/ה ${earned} נק'.`);
        }

        saveData();
    }

    res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
