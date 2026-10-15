# Amazon Chime SDK references

Use the **Amazon Chime SDK** docs only. The standalone "Amazon Chime" app was retired on 2026-02-20; its admin guide (`docs.aws.amazon.com/chime/latest/ag/`) does not apply.

| Topic | Link |
|---|---|
| JS SDK docs and API overview | https://aws.github.io/amazon-chime-sdk-js/ , https://aws.github.io/amazon-chime-sdk-js/modules/apioverview.html |
| JS SDK source, guides, demos | https://github.com/aws/amazon-chime-sdk-js |
| React component library (optional) | https://github.com/aws/amazon-chime-sdk-component-library-react |
| Meetings API (server: CreateMeeting, CreateAttendee, DeleteMeeting) | https://docs.aws.amazon.com/chime-sdk/latest/APIReference/API_Operations_Amazon_Chime_SDK_Meetings.html |
| Developer guide | https://docs.aws.amazon.com/chime-sdk/latest/dg/what-is-chime-sdk.html , https://docs.aws.amazon.com/chime-sdk/latest/dg/meetings-sdk.html |
| Regions, endpoints and quotas | https://docs.aws.amazon.com/general/latest/gr/chime-sdk.html |
| Pricing | https://aws.amazon.com/chime/chime-sdk/pricing/ |
| Playwright browser launch args (fake media flags) | https://playwright.dev/docs/api/class-browsertype |

## Concept map: Agora -> Chime

| Agora (bdl-gamestream-test) | Chime SDK (this app) |
|---|---|
| `/api/agora-token` (channel + uid -> token) | `POST /api/attendee` -> `CreateMeeting` + `CreateAttendee`; client gets Meeting + Attendee JSON |
| channel `${meetingId}-${code}` | one Chime meeting per room (`ExternalMeetingId`) |
| uid string | `ExternalUserId` (`human-<name>` / `bot-<name>`), plus server-assigned `AttendeeId` |
| `${uid}-screenshare` second client | built-in content share; tile bound to `<attendeeId>#content` |
| `useLocalMicrophoneTrack` / `usePublish` | `startAudioInput`, `startVideoInput`, `startLocalVideoTile` |
| `useRemoteUsers` | `realtimeSubscribeToAttendeeIdPresence` + `videoTileDidUpdate` |
| `volume-indicator` | `realtimeSubscribeToVolumeIndicator` |
| device hot swap | `addDeviceChangeObserver` + `startAudioInput/startVideoInput/chooseAudioOutput` |

## Not verified yet (check before deciding)
- Maximum attendees per meeting and maximum simultaneous video tiles.
- Latency by media region for your users.
- Equivalents for AI denoiser and virtual background (Chime has Voice Focus and background blur/replacement, which behave differently from Agora's extensions).
