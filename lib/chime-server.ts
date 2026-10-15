import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
  type Meeting,
} from '@aws-sdk/client-chime-sdk-meetings';

export type AttendeeKind = 'human' | 'bot';

const region = process.env.CHIME_MEDIA_REGION || 'us-east-1';

// Meetings API is served from a few control regions; the client region != media region.
const client = new ChimeSDKMeetingsClient({ region: process.env.AWS_REGION || 'us-east-1' });

// roomName -> Meeting. In-memory is fine for a test app; survives HMR via globalThis.
const g = globalThis as unknown as { __chimeMeetings?: Map<string, Meeting> };
const meetings = (g.__chimeMeetings ??= new Map<string, Meeting>());

export async function getOrCreateMeeting(room: string): Promise<Meeting> {
  const existing = meetings.get(room);
  if (existing) return existing;
  const res = await client.send(
    new CreateMeetingCommand({
      ClientRequestToken: `${room}-${Date.now()}`,
      ExternalMeetingId: room.slice(0, 64),
      MediaRegion: region,
    }),
  );
  if (!res.Meeting) throw new Error('CreateMeeting returned no meeting');
  meetings.set(room, res.Meeting);
  return res.Meeting;
}

export async function createAttendee(room: string, name: string, kind: AttendeeKind) {
  const meeting = await getOrCreateMeeting(room);
  const externalUserId = `${kind}-${name}`.replace(/[^\w@.\-#]/g, '_').slice(0, 64);
  const res = await client.send(
    new CreateAttendeeCommand({ MeetingId: meeting.MeetingId!, ExternalUserId: externalUserId }),
  );
  return { meeting, attendee: res.Attendee! };
}

export async function deleteMeeting(room: string) {
  const meeting = meetings.get(room);
  if (!meeting) return false;
  await client.send(new DeleteMeetingCommand({ MeetingId: meeting.MeetingId! }));
  meetings.delete(room);
  return true;
}
