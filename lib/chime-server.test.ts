import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-chime-sdk-meetings', () => {
  class Cmd { constructor(public input: unknown) {} }
  return {
    ChimeSDKMeetingsClient: class { send = send; },
    CreateMeetingCommand: class extends Cmd {},
    CreateAttendeeCommand: class extends Cmd {},
    DeleteMeetingCommand: class extends Cmd {},
  };
});

import { getOrCreateMeeting, createAttendee, deleteMeeting } from './chime-server';

beforeEach(() => send.mockReset());

describe('chime-server', () => {
  it('creates one meeting per room and reuses it', async () => {
    send.mockResolvedValueOnce({ Meeting: { MeetingId: 'm1' } });
    const a = await getOrCreateMeeting('r1');
    const b = await getOrCreateMeeting('r1');
    expect(a).toBe(b);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('prefixes attendee ExternalUserId by kind and sanitizes it', async () => {
    send.mockResolvedValueOnce({ Meeting: { MeetingId: 'm2' } });
    send.mockResolvedValueOnce({ Attendee: { AttendeeId: 'a1' } });
    await createAttendee('r2', 'bot 1!', 'bot');
    const cmd = send.mock.calls[1][0] as { input: { ExternalUserId: string } };
    expect(cmd.input.ExternalUserId).toBe('bot-bot_1_');
  });

  it('recreates the meeting once if the cached one has ended', async () => {
    send.mockResolvedValueOnce({ Meeting: { MeetingId: 'old' } }); // create
    send.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'NotFoundException' })); // attendee on old
    send.mockResolvedValueOnce({ Meeting: { MeetingId: 'new' } }); // create again
    send.mockResolvedValueOnce({ Attendee: { AttendeeId: 'a2' } }); // attendee on new
    const r = await createAttendee('r3', 'x', 'human');
    expect(r.meeting.MeetingId).toBe('new');
    expect(r.attendee.AttendeeId).toBe('a2');
  });

  it('deleteMeeting returns false for unknown rooms', async () => {
    expect(await deleteMeeting('nope')).toBe(false);
  });
});
