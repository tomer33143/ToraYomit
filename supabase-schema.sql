-- Supabase SQL schema for ToraYomit

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
  group_id text not null references groups(id) on delete cascade,
  points int not null default 0
);

create table tasks (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  description text not null,
  points int not null
);

create table feed (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  type text not null,
  text text not null,
  time timestamptz not null default now()
);

create table submissions (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  date text not null,
  tasks_done jsonb not null,
  submitted boolean not null default true,
  points_earned int not null,
  unique (user_id, date)
);
