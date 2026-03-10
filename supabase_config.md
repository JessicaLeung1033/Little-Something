# Supabase Configuration Checklist

Code-side config (script.js) is done — real URL + anon key + SDK loaded via CDN.

Below are the things to verify/do in the **Supabase dashboard** (`foudotnjsktfvckialca`).

---

## 1. Database Tables — Run in SQL Editor

```sql
CREATE TABLE moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '✦',
  photo_path TEXT,
  text TEXT NOT NULL DEFAULT '✦',
  color TEXT NOT NULL DEFAULT '#f7f7f5',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'collected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2. Row Level Security (RLS)

```sql
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own moments" ON moments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own stars" ON stars FOR ALL USING (auth.uid() = user_id);
```

## 3. Storage Bucket

- Go to **Storage** → **New bucket** → name it `photos`
- Set it to **private** (code uses signed URLs)
- Add a storage policy so authenticated users can upload to their own folder

## 4. Auth Providers

- **Email/Password** — Enable in **Authentication → Providers → Email** (usually on by default)
- **Phone (OTP)** — Requires:
  - Enable **Phone** provider in auth settings
  - Configure **Twilio** (Account SID, Auth Token, Messaging Service SID)
  - Without Twilio, phone login won't work (email login still works fine)

## Quick Verify

Go to Supabase dashboard → **Table Editor**. If you see `moments` and `stars` tables, the DB is set up. If not, run the SQL above.
