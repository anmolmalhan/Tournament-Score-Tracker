# Match Tracker

A head-to-head win tracker for any game or tournament: chess, cricket, carrom,
Monster, or a custom match. Players sign in with GitHub, create private
tournaments, invite each other, and every result is confirmed by the other
player before it counts. Built on [ZeroStarter](https://zerostarter.dev).

## How it works

- **GitHub is the only login.** No email/password, no Google, no guest mode. A
  player's identity is their GitHub account (username + avatar shown in-app).
- **Private, invite-only tournaments.** Only invited GitHub users can view or
  play a tournament; everyone else gets a 403.
- **Backend-authoritative scores.** The frontend never edits a score. It creates
  a pending request (win, correction, or reset); the score changes only when
  another player confirms it. You cannot confirm your own claim.
- **Permanent history + stats.** Every tournament, match event, and result is
  stored forever and aggregated into per-user statistics.
- **ntfy push notifications.** Each user sets one private ntfy topic; the server
  notifies the other players on a claim, and everyone on confirm / reject / win.

## Key files

- `packages/db/src/schema/tournament.ts` - tournaments, members, the permanent
  event log, and per-user settings
- `api/hono/src/routers/tournaments.ts` - create/join/invite, claim, and the
  confirm/reject flow (membership + "not your own claim" checks)
- `api/hono/src/routers/me.ts` - profile, ntfy settings, and computed stats
- `api/hono/src/lib/tournament.ts` / `ntfy.ts` - shared queries and push
- `web/next/src/app/{dashboard,tournaments,join}` - the app pages
- `web/next/src/components/app/*` - dashboard, tournament view, API hooks

## Setup

GitHub OAuth credentials are required. Create an OAuth App at
`https://github.com/settings/applications/new`:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:4000/api/auth/callback/github`

Put the values in the root `.env`:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

For production, create a second OAuth App whose callback points at the deployed
API domain (`https://<api-host>/api/auth/callback/github`), and set the same env
vars (plus `HONO_APP_URL`, `HONO_TRUSTED_ORIGINS`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_APP_URL`) on the Vercel projects.

Optional: `HONO_NTFY_BASE_URL` to point at a self-hosted ntfy (default
`https://ntfy.sh`).

## Development

```bash
bun run dev
```

Web on http://localhost:3000, API on http://localhost:4000, API reference at
http://localhost:4000/api/docs.
