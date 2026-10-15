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
