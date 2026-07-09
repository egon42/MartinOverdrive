# Cross-device sync — one-time Supabase setup

Sync lets anyone using the app keep their practice status/notes/timers in step across their
phone and computer. There are **no accounts and no GitHub tokens** — each user gets a private
128-bit *sync code* and their data lives behind it. To make that work you (the app owner)
stand up **one** free Supabase project once. After that, users just tap **Turn on sync** and
paste their code onto a second device.

The client talks to Supabase with plain `fetch` (no SDK). The only thing that ships in the
app is the project URL and the **anon (publishable) key** — both are public by design;
security comes from Row-Level Security plus the secret code, not from hiding the key.

## 1. Create the project

1. Sign up at <https://supabase.com> (free tier is enough — 5 users × ~15 KB is nothing).
2. Create a new project. Pick any region near the band; remember the database password (you
   won't need it for this).

## 2. Run the SQL

Open **SQL Editor → New query**, paste the whole block below, and run it. It creates the
table, locks it down (RLS on, no policy, no direct grants), and exposes exactly two
functions the app is allowed to call. Codes are **hashed at rest**, so even a full table dump
reveals no usable codes.

```sql
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.practice_sync (
  code_hash  text        primary key,          -- sha256 hex of the normalized code
  data       jsonb       not null,             -- {version, updatedAt, practice}
  updated_at timestamptz not null default now()
);

alter table public.practice_sync enable row level security;
revoke all on table public.practice_sync from anon, authenticated;

create or replace function public.hash_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(
    upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g')),'sha256'),'hex')
$$;

create or replace function public.get_practice(p_code text)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select data from public.practice_sync where code_hash = public.hash_code(p_code)
$$;

create or replace function public.upsert_practice(p_code text, p_data jsonb)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
  v_ts   timestamptz := now();
begin
  if length(v_norm) < 20 then raise exception 'invalid sync code'; end if;
  if length(p_data::text) > 65536 then raise exception 'payload too large'; end if;
  insert into public.practice_sync (code_hash, data, updated_at)
  values (public.hash_code(p_code), p_data, v_ts)
  on conflict (code_hash) do update set data = excluded.data, updated_at = excluded.updated_at;
  return v_ts;
end; $$;

revoke all on function public.hash_code(text)              from public;
revoke all on function public.get_practice(text)           from public;
revoke all on function public.upsert_practice(text, jsonb) from public;
grant execute on function public.get_practice(text)           to anon;
grant execute on function public.upsert_practice(text, jsonb) to anon;

notify pgrst, 'reload schema';  -- else the RPCs 404 until the schema cache reloads
```

Why it's built this way:
- **RLS on + no policy** means the anon role can never read or list the table directly — so
  nobody can dump everyone's codes. The two `security definer` functions run as the table
  owner and require the exact code as an argument.
- **`set search_path = ''`** + fully-qualified names close a `security definer` injection
  footgun. `extensions.digest` must stay qualified (pgcrypto lives in `extensions`).
- The write function **guards code shape and payload size** (≤ 64 KB). The anon key is
  public, so this stops a stranger from filling the free-tier disk with junk rows.

## 3. Wire the app to the project

1. In Supabase: **Project Settings → API**. Copy the **Project URL** and the **anon /
   publishable** key (NOT the `service_role` key — never put that in the app).
2. Edit [`src/syncBackend.ts`](src/syncBackend.ts) and replace the two placeholders:
   ```ts
   export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co'
   export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
   ```
3. Commit and deploy (`dev` first, then merge to `main`). Until these are filled in, the
   sync panel shows "Sync isn't set up on this build yet."

## 4. Use it

- **First device:** dashboard → **Turn on sync** → a code appears (e.g. `K7F2-9XQZ-…`).
- **Second device:** open the app → paste the code under "Have a code from another device?"
  → **Connect with a code**. Both devices now merge to the same data (per-song, newest edit
  wins).
- The `/dev/` build and the production build keep **separate** codes/rows on purpose.

## Operational notes

- **7-day auto-pause (the one real gotcha).** A free Supabase project pauses after ~1 week
  with no traffic; the next sync then cold-starts (tens of seconds) or briefly errors until
  it wakes. If the band goes quiet for a while, the first sync afterward may need a retry.
  Optional fix: a scheduled ping (a GitHub Action or <https://cron-job.org> hitting
  `POST {URL}/rest/v1/rpc/get_practice` with a throwaway `p_code` every few days) keeps it
  warm. A project left paused ~90 days can be **deleted** — so keep using the dashboard's
  **Export backup** as the real safety net.
- **Rotating a leaked code.** There's no auth to revoke; a leaked code grants read/write to
  that one blob forever. The remedy is to **Disconnect**, **Turn on sync** again for a fresh
  code, and stop using the old one.
- **What syncs:** only the practice blob (status, notes, priority, timers, sessions,
  per-song source prefs). Song content (setlist, tabs, chords) ships in the build and is
  already identical on every device.
