# Deploying the Branch viewer to Vercel

The hosted viewer is **read-only**. Visitors can browse and navigate reasoning trees fetched from Vercel Blob storage. Fork, inject, and stream are disabled — those actions require a local `claude` subprocess which doesn't exist on Vercel. The UI hides those buttons and shows an install CTA instead; the API routes also return 403 for any non-localhost host as defense-in-depth.

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`
- Logged in: `vercel login`
- A Vercel Blob store created at https://vercel.com/dashboard/stores

## Environment variables

Set these in your Vercel project settings (Settings → Environment Variables) before deploying:

| Variable | Required | Description |
|---|---|---|
| `BRANCH_BLOB_BASE` | Yes | Base URL of your Blob store, e.g. `https://abc123.public.blob.vercel-storage.com` |
| `NEXT_PUBLIC_BRANCH_WS_URL` | No | WebSocket server URL for real-time presence. Leave unset — presence is automatically disabled in hosted mode. |
| `BRANCH_ALLOW_HOSTED_EDITS` | No | Set to `1` only if you want fork/inject enabled on a hosted deployment. **Not recommended** unless you have added API key auth — leaving fork/inject open on a public deployment exposes your `claude` subscription to abuse. |

## Deploy

```bash
cd viewer
vercel deploy --prod
```

Vercel will build the Next.js app and give you a production URL like `https://branch-viewer-xxx.vercel.app`.

## Sharing sessions

Once deployed, upload a session from the CLI:

```bash
export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
branch share <sessionId>
```

Then share:
```
https://your-viewer.vercel.app/t/<sessionId>
```

## Real-time presence note

Real-time presence (live cursors) requires a separate WebSocket server. In hosted mode the viewer automatically skips presence wiring entirely — no errors, no broken UI. If you want presence on a hosted deployment you would need to:

1. Deploy `ws-server.mjs` to a long-running Node host (Fly.io, Railway, etc.)
2. Set `NEXT_PUBLIC_BRANCH_WS_URL` to point at it on your Vercel project and redeploy

To deploy the WS server on Railway:
1. Create a new Railway service pointed at the `branch-ai` repo
2. Set the start command to `node viewer/ws-server.mjs`
3. Set `BRANCH_WS_PORT` to the port Railway exposes
4. Copy the public URL into `NEXT_PUBLIC_BRANCH_WS_URL` on your Vercel project and redeploy

## What works in hosted mode

| Feature | Hosted | Local |
|---|---|---|
| Browse/navigate reasoning trees | Yes | Yes |
| View session from Blob storage | Yes | Yes |
| Gallery | Yes | Yes |
| Fork from node | No (CTA shown) | Yes |
| Inject fact | No (CTA shown) | Yes |
| Run new prompt | No (hidden) | Yes |
| Search past sessions | No (hidden) | Yes |
| Real-time presence | No (skipped) | Yes |
