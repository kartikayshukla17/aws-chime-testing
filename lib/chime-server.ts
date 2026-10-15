import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  GetMeetingCommand,
  DeleteMeetingCommand,
  type Meeting,
} from '@aws-sdk/client-chime-sdk-meetings';
import { del, getJSON, setIfAbsent } from './store';

export type AttendeeKind = 'human' | 'bot';

const region = process.env.CHIME_MEDIA_REGION || 'us-east-1';
const client = new ChimeSDKMeetingsClient({ region: process.env.AWS_REGION || 'us-east-1' });

const MEETING_TTL_SEC = 4 * 60 * 60;
const key = (room: string) => `meeting:${room}`;

async function createMeeting(room: string): Promise<Meeting> {
  const res = await client.send(
    new CreateMeetingCommand({
      ClientRequestToken: `${room}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ExternalMeetingId: room.slice(0, 64),
      MediaRegion: region,
    }),
  );
  if (!res.Meeting) throw new Error('CreateMeeting returned no meeting');
  // If two people join at once, only the first write wins; the loser's meeting is orphaned and ends on its own.
  if (!(await setIfAbsent(key(room), res.Meeting, MEETING_TTL_SEC))) {
    const winner = await getJSON<Meeting>(key(room));
    if (winner) return winner;
  }
  return res.Meeting;
}

// True only if the room's meeting is still running in Chime (a meeting ends 5 min after the last person leaves).
export async function meetingExists(room: string): Promise<boolean> {
  const m = await getJSON<Meeting>(key(room));
  if (!m) return false;
  try {
    await client.send(new GetMeetingCommand({ MeetingId: m.MeetingId! }));
    return true;
  } catch (e) {
    if ((e as Error).name !== 'NotFoundException') throw e;
    await del(key(room)); // ended: forget it so the next person starts a fresh one
    return false;
  }
}

export const peekMeeting = (room: string) => getJSON<Meeting>(key(room));

export async function getOrCreateMeeting(room: string): Promise<Meeting> {
  return (await getJSON<Meeting>(key(room))) ?? createMeeting(room);
}

export async function createAttendee(room: string, name: string, kind: AttendeeKind) {
  // Spaces are kept so display names like "Bold Fox" read properly; '#' is reserved for content-share ids.
  const externalUserId = `${kind}-${name}`.replace(/[^\w@.\- ]/g, '_').slice(0, 64);
  const attempt = async (meeting: Meeting) =>
    client.send(new CreateAttendeeCommand({ MeetingId: meeting.MeetingId!, ExternalUserId: externalUserId }));

  let meeting = await getOrCreateMeeting(room);
  try {
    return { meeting, attendee: (await attempt(meeting)).Attendee! };
  } catch (e) {
    // The cached meeting may have ended (everyone left). Drop it and start a fresh one once.
    if ((e as Error).name !== 'NotFoundException') throw e;
    await del(key(room));
    meeting = await createMeeting(room);
    return { meeting, attendee: (await attempt(meeting)).Attendee! };
  }
}

export async function deleteMeeting(room: string) {
  const meeting = await getJSON<Meeting>(key(room));
  if (!meeting) return false;
  await client.send(new DeleteMeetingCommand({ MeetingId: meeting.MeetingId! })).catch((e) => {
    if ((e as Error).name !== 'NotFoundException') throw e;
  });
  await del(key(room));
  return true;
}
