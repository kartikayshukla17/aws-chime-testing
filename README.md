# aws-chime-testing

Standalone app for evaluating the Amazon Chime SDK as a replacement for Agora in bdl-gamestream-test. It does not modify that repo.

## Setup
1. `npm install && npx playwright install chromium`
2. `cp .env.example .env` and fill in AWS credentials (IAM actions needed: `chime:CreateMeeting`, `chime:CreateAttendee`, `chime:DeleteMeeting`, `chime:GetMeeting`).
3. `npm run assets` (needs ffmpeg) to generate the fake camera/mic files used by bots.
4. `npm run dev` then open http://localhost:3100

## Testing with multiple users
- Open `/room/test` in several tabs or browsers and join with different names.
- Use the **Proxy users** panel in a room to launch headless Chromium bots. They run the same client code, publish a looping test video and a 440 Hz tone, and can start a screenshare.
- Bots run on this machine, so keep the count modest. `MAX_BOTS` caps it (default 10).

- **Login:** passwordless. Everyone enters a display name and gets a signed session cookie. Set `ACCESS_CODE` to require a shared invite code.
- **What each user receives:** open `/dashboard/<room>` (link in the room header). Every client reports remote video resolution/fps/bitrate/loss, which speakers it can hear, RTT and audio loss. Bots also show a live screenshot of what their page renders.

See `docs/REFERENCES.md` for docs and the Agora -> Chime concept map.

## Deploying to Vercel
1. Add **Upstash Redis** from the Vercel Marketplace (sets the Redis env vars). Meetings and metrics reports live there.
2. Set env vars on the project: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `CHIME_MEDIA_REGION`, `SESSION_SECRET` (long random), `ACCESS_CODE` (the URL is public, so require it), `COOKIE_SECURE=1`, `BOT_KEY` (long random). Do NOT set `ENABLE_BOTS`.
3. Bots can't run on Vercel. Run them from your machine against the deployed URL, with the same `BOT_KEY` (and `ACCESS_CODE` is not needed for bots) in your local `.env`:
   `npm run bots -- --url https://<app>.vercel.app --room test --count 5`
4. Locally, leave the Redis vars empty to use in-memory state, and set `ENABLE_BOTS=1` to get the in-room bot panel.
