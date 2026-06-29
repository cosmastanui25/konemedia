# SEO Desk — setup & hosting guide

A single-file task & client manager for an SEO agency. It runs entirely in the browser, so hosting it is as simple as putting one file on your subdomain.

The whole app is **`index.html`**. That's it — no build step, no server code.

---

## 1. Try it right now (Local mode)

Double-click `index.html` to open it in your browser. Everything works immediately. In **Local mode** your data is saved in that one browser only (nothing is shared with your team yet). This is perfect for evaluating it.

Go to **Settings** first and put in your name — that's what the "assign to / assigned by" features use.

---

## 2. Put it on your subdomain

Pick whichever matches your setup. In all cases you're just hosting one static file.

**A. cPanel / shared hosting (most common)**
1. In your host's control panel, create a subdomain, e.g. `tasks.yourdomain.com`.
2. It will create a folder (e.g. `/public_html/tasks/`).
3. Upload `index.html` into that folder.
4. Visit `https://tasks.yourdomain.com` — done.

**B. Netlify / Vercel / Cloudflare Pages (free)**
1. Drag the folder containing `index.html` onto their dashboard ("deploy manually").
2. In the project's domain settings, add `tasks.yourdomain.com` as a custom domain.
3. Add the CNAME record they give you at your DNS provider.

**C. Already have a site?** Just drop `index.html` into a `/tasks/` folder on your existing site and visit `yourdomain.com/tasks/`.

> Want to keep it private? Add HTTP basic-auth at the host level (cPanel "Directory Privacy", or a Netlify/Cloudflare access rule), or simply don't link to the subdomain publicly.

---

## 3. Turn it into a team workspace (sign-up with email)

Local mode doesn't sync between people. To make it a real shared workspace — where you send someone the link, they sign up with their email, and instantly join as a Manager — connect a free **Supabase** project. About 10 minutes, once.

**Step 1 — create the project**
1. Go to supabase.com, sign up, create a new project (free). Pick any name/password.

**Step 2 — create the tables**
Open the project's **SQL Editor**, paste this in, and run it:

```sql
create table if not exists clients (
  id text primary key, payload jsonb not null, created_at timestamptz default now());
create table if not exists tasks (
  id text primary key, payload jsonb not null, created_at timestamptz default now());
create table if not exists members (
  id uuid primary key, email text, name text, role text, created_at timestamptz default now());
create table if not exists qbr (
  id text primary key, payload jsonb not null, created_at timestamptz default now());

alter table clients enable row level security;
alter table tasks   enable row level security;
alter table members enable row level security;
alter table qbr     enable row level security;

drop policy if exists "team access" on clients;
drop policy if exists "team access" on tasks;
drop policy if exists "team access" on members;
drop policy if exists "team access" on qbr;

create policy "team access" on clients for all to authenticated using (true) with check (true);
create policy "team access" on tasks   for all to authenticated using (true) with check (true);
create policy "team access" on members for all to authenticated using (true) with check (true);
create policy "team access" on qbr     for all to authenticated using (true) with check (true);
```

This keeps the workspace private: only people who have signed up and logged in can read or write anything.

**Step 3 — let people sign up instantly (important)**
By default Supabase emails every new user a confirmation link before they can log in. For a smooth "sign up and you're in" experience, turn that off:
- In Supabase → **Authentication → Sign In / Providers → Email**, switch **Confirm email** OFF.
  (On older dashboards it's **Authentication → Settings → "Enable email confirmations"**.)

If you'd rather keep confirmation on, that's fine — new members just have to click the link in their email once before logging in.

**Step 4 — get your keys**
In **Project Settings → API**, copy the **Project URL** and the **anon / public** key.

**Step 5 — paste them into the file**
Open `index.html`, find the `CONFIG` block near the top of the script, and fill it in:

```js
const CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "your-long-anon-key"
};
```

Re-upload the file. Now when anyone opens the subdomain they'll see a **Sign up / Log in** screen instead of going straight in.

**How your team joins:** send them the workspace link → they click **Sign up**, enter their name, email and a password → they're in, automatically as a **Manager**, and they'll appear under Settings → Workspace members so you can assign tasks to them.

> **Security note:** anyone who can reach the subdomain can *attempt* to sign up, so don't post the link publicly. To control exactly who can join, see the next section.

## 3b. Restrict sign-up to your company email (and "Confirm email" explained)

**"Confirm email"** (Supabase → Authentication → Email) decides whether a new user must click a verification link before logging in. ON = the mailbox is verified but you depend on Supabase's rate-limited free email (slow, can hit spam). OFF = instant login, no verification. It controls *mailbox verification*, not *who is allowed to join* — that's the domain rule below. For a small team, leaving it OFF plus the domain rule below is the smooth, safe combination.

**Lock sign-up to one domain — two layers:**

*Layer 1 (in the app):* in the `CONFIG` block of `index.html`, set
```js
ALLOWED_EMAIL_DOMAINS: ["konemedia.co.ke"]   // or [] to allow any email
```
This shows a clear "company emails only" message and blocks others. To allow more than one: `["konemedia.co.ke","otherco.com"]`.

*Layer 2 (in the database — the real enforcement):* run this once in the Supabase SQL Editor so the rule can't be bypassed:
```sql
create or replace function public.enforce_email_domain()
returns trigger language plpgsql security definer as $$
begin
  if lower(split_part(NEW.email, '@', 2)) <> 'konemedia.co.ke' then
    raise exception 'Sign-up is restricted to konemedia.co.ke email addresses.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_email_domain_trigger on auth.users;
create trigger enforce_email_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_email_domain();
```
Keep the domain in Layer 1 and Layer 2 matching. For multiple domains in Layer 2, change the condition to `not in ('konemedia.co.ke','otherco.com')`.

---

## 4. The workflow it's built around

This mirrors how an agency actually delivers (you send recommendations, the client's team implements):

1. **Create a task** → pick the client, type (Keyword Research, Technical, etc.), priority, frequency (one-off / weekly / monthly / quarterly), due date.
2. **Start** → **Mark done** (you attach a link to the deliverable) → **Send to client**.
3. After sending, mark whether the **client's IT team implemented it** or **didn't action it**. That "not done by client side" state is tracked so it shows up in reports.
4. **This Week** lines up open tasks by priority, then by due date. New tasks you add mid-week slot straight in.
5. **Assignments** is where a manager writes a brief, sets the date it's needed, and picks who it goes to. It then appears in that person's queue.
6. **Clients → a client → Completed archive** lets you pull exactly what was delivered, filtered by week / month / quarter — that's your meeting prep.

---

## 5. Reports → slides

In **Reports**: pick a client and a period. The tool gathers everything you delivered, then for each item you can tick **needs screenshot** and add a one-line context bullet.

Two outputs:
- **Preview slides** — renders a clean deck right in the page; **Print / Save as PDF** to export.
- **Copy tasks for Claude** — copies just that client's tasks for the period, split into **Completed** and **Not completed** (with the client-side status, e.g. *not done by client*), and nothing else. Paste it into a Claude chat where you've described your slide format and it'll build the deck.

You can keep your house slide format saved in **Settings → Report slide format** as a reference for yourself.

---

## 6. Backups

In **Settings → Data & backup** you can export a `.json` backup and re-import it. Do this regularly while you're in Local mode (since the data lives in your browser). In Team mode your data is safe in Supabase, but the export is still handy.
