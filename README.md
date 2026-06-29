# ToraYomit

פרויקט "תורה יומית" עם תשתית סטטית ב־Vercel ושמירת נתונים ב־Supabase.

## מה כלול

- `index.html` + `style.css` + `app.js` — ממשק המשתמש
- `api/` — פונקציות Node עבור נקודות קצה של Supabase
- `package.json` — סקריפטי הרצה ותלותיות
- `vercel.json` — הגדרת פריסה ל־Vercel

## דרישות

- חשבון Supabase
- פרויקט Supabase פעיל
- חשבון Vercel עם חיבור ל־GitHub
- Node.js 20+ (לפריסה ב־Vercel ולהרצה מקומית בעזרת `vercel dev`)

## יצירת טבלאות ב־Supabase

פתח את SQL Editor ב־Supabase והפעל את השאילתה הבאה:

```sql
create table groups (
  id text primary key,
  name text not null,
  code text not null unique,
  rabbi_id text not null,
  bonus int not null default 10,
  date text not null
);

create table users (
  id text primary key,
  phone text not null unique,
  password text not null,
  name text not null,
  role text not null,
  group_id text not null references groups(id),
  points int not null default 0
);

create table tasks (
  id text primary key,
  group_id text not null references groups(id),
  description text not null,
  points int not null
);

create table feed (
  id text primary key,
  group_id text not null references groups(id),
  type text not null,
  text text not null,
  time timestamptz not null
);

create table submissions (
  id text primary key,
  group_id text not null references groups(id),
  user_id text not null references users(id),
  date text not null,
  tasks_done jsonb not null,
  submitted boolean not null default true,
  points_earned int not null,
  unique (user_id, date)
);
```

## משתני סביבה

הוסף ב־Vercel את המשתנים הבאים:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_KEY` (אפשרי, בשביל אבטחת קריאות ל־API)

> אם תגדיר `API_KEY`, כל קריאה לנקודות קצה ב־`/api/...` תצטרך להעביר אותו ב־header.
> אם `API_KEY` לא מוגדר, ה־API ימשיך לעבוד ללא בדיקה.

### איך להשתמש ב־API key

ב־בקשות ל־API שתרצה להגן עליהן, שלח את ה־key באחד מהשדות האלה:

- header `Authorization: Bearer <API_KEY>`
- או header `x-api-key: <API_KEY>`

דוגמה ב־JavaScript:

```js
fetch('/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({ phone, password })
});
```

### חשוב — אבטחה

- אם האתר שלך רץ ישירות בדפדפן (frontend JavaScript), ה־API key יהיה גלוי לכל מי שמסתכל ב־Network או בקוד המקור.
- לכן, אם זהו אתר ציבורי, חשוב להשתמש ב־proxy צד שרת או ב־serverless function כדי שלא לחשוף את ה־API key בדפדפן.
- אם אתה רק מבצע קריאות משרת צד / Vercel serverless, אפשר לשלוח את ה־API key בבטחה.

## פריסה ל־Vercel

1. חבר את ה־GitHub repository ל־Vercel.
2. ודא שהטבלאות ב־Supabase נוצרו.
3. הוסף את משתני הסביבה ב־Vercel.
4. פרסם את ענף `main`.

## פיתוח מקומי

```bash
npm install
npm run dev
```

### הערות חשובות

- ה־API משתמש בנתיב `api/` ב־Vercel.
- הקבצים הסטטיים (`index.html`, `style.css`, `app.js`) יוגשו אוטומטית.
- בקוד הלקוח בקובץ `app.js` כל הקריאות פונות ל־`/api/...`.
