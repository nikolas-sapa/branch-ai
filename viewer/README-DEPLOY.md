# Deploying the Branch viewer to Vercel

This deploys the read-only hosted viewer so you can share session URLs with people who don't have Branch installed locally.

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`
- Logged in: `vercel login`
- A Vercel Blob store created at https://vercel.com/dashboard/stores

## Environment variables

Set these in your Vercel project settings (Settings → Environment Variables) before deploying:

| Variable | Required | Description |
|---|---|---|
| `BRANCH_BLOB_BASE` | Yes | Base URL of your Blob store, e.g. `https://abc123.public.blob.vercel-storage.com` |
| `NEXT_PUBLIC_BRANCH_WS_URL` | No | WebSocket server URL for real-time presence cursors. Leave unset if you don't need presence on the hosted viewer — it will degrade gracefully to read-only. |

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

Real-time presence (live cursors) requires a separate WebSocket server. The Vercel-deployed viewer works for read-only sharing of session URLs but presence cursors won't function unless you also deploy `ws-server.mjs` to a long-running Node host (Fly.io, Railway, etc.) and set `NEXT_PUBLIC_BRANCH_WS_URL` to point at it.

To deploy the WS server on Railway:
1. Create a new Railway service pointed at the `branch-ai` repo
2. Set the start command to `node viewer/ws-server.mjs`
3. Set `BRANCH_WS_PORT` to the port Railway exposes
4. Copy the public URL into `NEXT_PUBLIC_BRANCH_WS_URL` on your Vercel project and redeploy
