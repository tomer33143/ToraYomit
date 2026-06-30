const API = '/api';

// ─── State ───────────────────────────────────────────────
let currentUser   = null;
let currentGroup  = null;
let groupUsers    = [];
let submissions   = {};

let htmlCache = { feed: null, tasks: null, leaderboard: null };
let localChecked  = new Set();   // task IDs ticked locally but not yet submitted
let newFeedCount  = 0;           // for badge on Feed tab
let seenFeedCount = 0;           // how many feed items user has seen
let pollTimer     = null;

// ─── Boot ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    console.log('🔵 ToraYomit loading...');
    const saved = localStorage.getItem('toraUser');
    if (saved) {
        console.log('✅ User found in localStorage');
        currentUser = JSON.parse(saved);
        showApp();
    } else {
        console.log('📝 No user, showing auth');
        showAuth();
    }
    console.log('✅ ToraYomit loaded successfully');
});

// ─── Auth tabs ───────────────────────────────────────────
function switchAuthTab(tab) {
    ['login','join','create'].forEach(t => {
        document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', ['login','join','create'][i] === tab);
    });
}

// ─── Auth actions ────────────────────────────────────────
async function login() {
    const phone    = v('loginPhone');
    const password = v('loginPass');
    if (!phone || !password) return toast('הכנס טלפון וסיסמא', 'error');
    const data = await api('login', { phone, password });
    if (data.error) return toast(data.error, 'error');
    loginSuccess(data.user);
}

async function joinGroup() {
    const name     = v('joinName');
    const phone    = v('joinPhone');
    const password = v('joinPass');
    const code     = v('joinCode').toUpperCase();
    if (!name || !phone || !password || !code) return toast('אנא מלא את כל השדות', 'error');
    const data = await api('join-group', { name, phone, password, code });
    if (data.error) return toast(data.error, 'error');
    loginSuccess(data.user);
}

async function createGroup() {
    const name      = v('createName');
    const phone     = v('createPhone');
    const password  = v('createPass');
    const groupName = v('createGroupName');
    if (!name || !phone || !password || !groupName) return toast('אנא מלא את כל השדות', 'error');
    const data = await api('create-group', { name, phone, password, groupName });
    if (data.error) return toast(data.error, 'error');
    loginSuccess(data.user);
}

function loginSuccess(user) {
    currentUser = user;
    localStorage.setItem('toraUser', JSON.stringify(user));
    showApp();
}

function logout() {
    clearInterval(pollTimer);
    localStorage.removeItem('toraUser');
    currentUser = null;
    htmlCache = { feed: null, tasks: null, leaderboard: null };
    localChecked.clear();
    newFeedCount = 0;
    seenFeedCount = 0;
    showAuth();
}

// ─── Views ───────────────────────────────────────────────
function showAuth() {
    try {
        console.log('📝 Showing Auth View');
        const authView = el('authView');
        const appView = el('appView');
        
        if (!authView || !appView) {
            console.error('❌ Missing HTML elements - authView or appView not found');
            document.body.innerHTML = '<div style="color:red; padding:20px;"><h1>שגיאה בטעינה</h1><p>אלמנטים HTML חסרים</p></div>';
            return;
        }
        
        authView.style.display = 'flex';
        appView.style.display = 'none';
        console.log('✅ Auth View displayed');
    } catch (e) {
        console.error('❌ Error in showAuth:', e);
        document.body.innerHTML = '<div style="color:red; padding:20px;"><p>' + e.message + '</p></div>';
    }
}

function showApp() {
    try {
        console.log('🎯 Showing App View');
        const authView = el('authView');
        const appView = el('appView');
        const userGreeting = el('userGreeting');
        const rabbiMsgBox = el('rabbiMsgBox');
        
        if (!authView || !appView) {
            console.error('❌ Missing HTML elements');
            return;
        }
        
        authView.style.display = 'none';
        appView.style.display = 'block';
        
        if (userGreeting) {
            userGreeting.textContent = currentUser.name || 'שלום';
        }

        if (currentUser.role === 'rabbi' && rabbiMsgBox) {
            rabbiMsgBox.style.display = 'flex';
        }

        switchTab('tasks');
        console.log('✅ App View displayed');
    } catch (e) {
        console.error('❌ Error in showApp:', e);
        document.body.innerHTML = '<div style="color:red; padding:20px;"><p>' + e.message + '</p></div>';
    }
}
    fetchState();
    pollTimer = setInterval(fetchState, 2000);
}

// ─── Tabs ────────────────────────────────────────────────
function switchTab(tab) {
    ['feed','tasks','leaderboard'].forEach(t => {
        const col = el(`col-${t}`);
        col.classList.toggle('mobile-active', t === tab);
    });
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'feed') {
        seenFeedCount = newFeedCount;
        updateFeedBadge(0);
    }
}

function updateFeedBadge(n) {
    const badge = el('feedBadge');
    if (n > 0) {
        badge.textContent = n > 9 ? '9+' : n;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ─── Fetch State ─────────────────────────────────────────
async function fetchState() {
    const data = await api('state', { userId: currentUser.id });
    if (!data || data.error) { return logout(); }

    const prevFeedLen = currentGroup?.feed?.length ?? 0;

    currentGroup = data.group;
    groupUsers   = data.users || [];
    submissions  = data.submissions || {};

    // Update user name from server (in case it was undefined in localStorage)
    if (data.user && data.user.name) {
        currentUser.name = data.user.name;
        el('userGreeting').textContent = currentUser.name;
    }

    // Feed badge
    if (currentGroup.feed.length > prevFeedLen && prevFeedLen > 0) {
        const added = currentGroup.feed.length - prevFeedLen;
        newFeedCount += added;
        const activeTab = document.querySelector('.nav-btn.active')?.dataset?.tab;
        if (activeTab !== 'feed') updateFeedBadge(newFeedCount - seenFeedCount);
    }
    newFeedCount = currentGroup.feed.length;

    renderAll();
}

async function sendAction(action, payload = {}) {
    await api('action', { userId: currentUser.id, action, payload });
    await fetchState();
}

// ─── Render ───────────────────────────────────────────────
function renderAll() {
    // Header
    el('groupNameLabel').textContent = currentGroup.name || '';
    el('groupCodeLabel').textContent = currentGroup.code || '';

    // Deadline display
    const deadlineEl = el('deadlineDisplay');
    const hoursLeft  = getHoursUntilMidnight();
    if (hoursLeft <= 0) {
        deadlineEl.textContent = 'הגשה נסגרה';
        deadlineEl.className = 'deadline-badge';
    } else if (hoursLeft <= 3) {
        deadlineEl.textContent = `⏰ ${hoursLeft} שעות לסיום`;
        deadlineEl.className = 'deadline-badge';
    } else {
        deadlineEl.textContent = `⏱ ${hoursLeft} שעות`;
        deadlineEl.className = 'deadline-badge ok';
    }

    renderFeed();
    renderTasks();
    renderLeaderboard();
}

// ─── Feed ────────────────────────────────────────────────
function renderFeed() {
    if (!currentGroup.feed || currentGroup.feed.length === 0) {
        setIfChanged('feedList', `
            <div class="empty-state">
                <i class="fa-solid fa-comments"></i>
                <p>אין עדכונים עדיין</p>
            </div>
        `, 'feed');
        return;
    }

    const html = currentGroup.feed.map(f => {
        const cls  = f.type === 'rabbi' ? 'feed-item-rabbi' : 'feed-item-system';
        const icon = f.type === 'rabbi' ? '👑 הרב' : '🔔 מערכת';
        const d    = new Date(f.time);
        const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return `<div class="feed-item ${cls}">
            <strong>${icon}</strong>
            ${escHtml(f.text)}
            <span class="feed-time">${time}</span>
        </div>`;
    }).join('');

    setIfChanged('feedList', html, 'feed');
}

// ─── Tasks ────────────────────────────────────────────────
function renderTasks() {
    const isRabbi = currentUser.role === 'rabbi';
    const today   = currentGroup.meta.date;
    const sub     = submissions[today]?.[currentUser.id] || { tasksDone: [], submitted: false };
    const tasks   = currentGroup.tasks;

    let html = '';

    if (isRabbi) {
        // Rabbi control panel
        html += `
        <div class="rabbi-add-task">
            <label>הוסף משימה חדשה</label>
            <div class="task-input-row">
                <input type="text" id="tDesc" class="form-control" placeholder="לדוג׳: דף יומי דף ל׳">
                <input type="number" id="tPts" class="form-control" placeholder="נק׳" min="1" max="100">
                <button class="btn btn-primary btn-sm" onclick="addTask()"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div class="bonus-row">
                <label>בונוס על סיום הכל:</label>
                <input type="number" id="tBonus" class="form-control" value="${currentGroup.meta.bonus}" min="0">
                <button class="btn btn-secondary btn-sm" onclick="updateBonus()">עדכן</button>
            </div>
        </div>`;
    } else {
        // Instruction for student
        html += `<p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem;">סמן את מה שביצעת היום באמינות. ניתן להגיש עד חצות.</p>`;
    }

    if (tasks.length === 0) {
        html += `<div class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>${isRabbi ? 'הוסף משימות לתלמידים' : 'הרב טרם העלה משימות להיום'}</p></div>`;
        setIfChanged('tasksContainer', html, 'tasks');
        return;
    }

    // Progress bar (students only)
    if (!isRabbi && !sub.submitted) {
        const checkedCount = tasks.filter(t => sub.tasksDone.includes(t.id) || localChecked.has(t.id)).length;
        const pct = Math.round((checkedCount / tasks.length) * 100);
        html += `
        <div class="task-progress">
            <div class="progress-label"><span>התקדמות</span><span>${checkedCount}/${tasks.length}</span></div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }

    html += `<ul class="task-list">`;
    tasks.forEach(t => {
        const checked = sub.tasksDone.includes(t.id) || localChecked.has(t.id);
        const disabled = sub.submitted || isRabbi;

        html += `<li class="task-item">
            <div class="task-content">
                ${!isRabbi ? `<input type="checkbox" class="custom-checkbox" value="${t.id}"
                    ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
                    onchange="onTaskCheck(this)">` : ''}
                <span class="task-desc ${checked ? 'done' : ''}">${escHtml(t.desc)}</span>
            </div>
            <div class="task-actions">
                <span class="task-points">+${t.points}</span>
                ${isRabbi ? `<button class="btn btn-danger btn-sm" onclick="sendAction('REMOVE_TASK',{taskId:'${t.id}'})"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </li>`;
    });
    html += `</ul>`;

    if (!isRabbi) {
        if (!sub.submitted) {
            html += `
            <div class="bonus-hint">🎁 סיים הכל = +${currentGroup.meta.bonus} נק' בונוס!</div>
            <button class="btn btn-primary w-100" onclick="submitMyTasks()">
                <i class="fa-solid fa-check-circle"></i> הגש משימות
            </button>`;
        } else {
            const totalEarned = sub.pointsEarned ?? 0;
            html += `<div class="success-banner">🎉 הגשת בהצלחה! קיבלת ${totalEarned} נק׳ היום</div>`;
        }
    }

    setIfChanged('tasksContainer', html, 'tasks');
}

// ─── Leaderboard ──────────────────────────────────────────
function renderLeaderboard() {
    const students = groupUsers.filter(u => u.role !== 'rabbi');
    const sorted   = [...students].sort((a, b) => b.points - a.points);

    if (sorted.length === 0) {
        setIfChanged('leaderboardList', `<div class="empty-state"><i class="fa-solid fa-users"></i><p>אין תלמידים בקבוצה עדיין</p></div>`, 'leaderboard');
        return;
    }

    const medals = ['🥇','🥈','🥉'];
    const html = sorted.map((u, i) => {
        const rc     = i < 3 ? `rank-${i+1}` : '';
        const medal  = medals[i] || `#${i+1}`;
        const isMe   = u.id === currentUser.id;
        return `
        <div class="leaderboard-item ${rc}" ${isMe ? 'style="outline:2px solid var(--primary);outline-offset:2px;"' : ''}>
            <div class="rank-info">
                <span class="rank-medal">${medal}</span>
                <span class="rank-name">${escHtml(u.name || 'ללא שם')}${isMe ? ' (אתה)' : ''}</span>
            </div>
            <span class="rank-pts">${u.points} נק׳</span>
        </div>`;
    }).join('');

    setIfChanged('leaderboardList', html, 'leaderboard');
}

// ─── Task interaction ─────────────────────────────────────
function onTaskCheck(checkbox) {
    const id = checkbox.value;
    if (checkbox.checked) localChecked.add(id);
    else localChecked.delete(id);

    // Update span style locally — no re-render
    const span = checkbox.nextElementSibling;
    if (span) {
        span.classList.toggle('done', checkbox.checked);
    }

    // Update progress bar without full re-render
    const today = currentGroup.meta.date;
    const sub   = submissions[today]?.[currentUser.id] || { tasksDone: [] };
    const tasks = currentGroup.tasks;
    const checkedCount = tasks.filter(t => sub.tasksDone.includes(t.id) || localChecked.has(t.id)).length;
    const pct = Math.round((checkedCount / tasks.length) * 100);
    const fill = document.querySelector('.progress-bar-fill');
    const label = document.querySelector('.progress-label span:last-child');
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${checkedCount}/${tasks.length}`;

    // Lock cache so poll doesn't overwrite
    htmlCache.tasks = el('tasksContainer').innerHTML;
}

async function submitMyTasks() {
    const checked = [...document.querySelectorAll('.custom-checkbox:checked')].map(c => c.value);
    if (checked.length === 0 && !confirm('לא סימנת כלום. להגיש בכל זאת?')) return;
    localChecked.clear();
    htmlCache.tasks = null; // force full re-render after submit
    await sendAction('SUBMIT_TASKS', { tasksDone: checked, date: currentGroup.meta.date });
}

// ─── Rabbi actions ────────────────────────────────────────
function addTask() {
    const desc   = el('tDesc').value.trim();
    const points = parseInt(el('tPts').value);
    if (!desc || !points || points < 1) return toast('הכנס תיאור משימה ונקודות', 'error');
    el('tDesc').value = '';
    el('tPts').value  = '';
    sendAction('ADD_TASK', { desc, points });
}

function updateBonus() {
    const bonus = parseInt(el('tBonus').value);
    if (isNaN(bonus)) return toast('ערך לא תקין', 'error');
    sendAction('UPDATE_BONUS', { bonus });
}

function postRabbiMessage() {
    const text = el('rabbiMsgText').value.trim();
    if (!text) return;
    el('rabbiMsgText').value = '';
    sendAction('POST_MESSAGE', { text });
    switchTab('feed'); // Switch to feed so rabbi sees it posted
}

// ─── Utilities ───────────────────────────────────────────
function api(endpoint, body) {
    return fetch(`${API}/${endpoint}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('apiKey') || 'default'}`
        },
        body: JSON.stringify(body)
    }).then(r => r.json()).catch(e => { console.error(e); return {}; });
}

function el(id) { return document.getElementById(id); }
function v(id)  { return el(id)?.value?.trim() ?? ''; }
function pad(n) { return String(n).padStart(2,'0'); }

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function setIfChanged(id, html, cacheKey) {
    if (html !== htmlCache[cacheKey]) {
        el(id).innerHTML = html;
        htmlCache[cacheKey] = html;
    }
}

function getHoursUntilMidnight() {
    const now = new Date();
    const israel = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem', hour: 'numeric', minute: 'numeric', hour12: false
    }).format(now);
    const [h, m] = israel.split(':').map(Number);
    return Math.max(0, 24 - h - (m > 0 ? 1 : 0));
}

function toast(msg, type = 'info') {
    // Simple alert fallback — can be upgraded to a nice toast
    alert(msg);
}
