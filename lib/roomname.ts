const ADJ = ['swift', 'quiet', 'brave', 'lucky', 'calm', 'witty', 'bold', 'sunny', 'merry', 'keen'];
const NOUN = ['otter', 'falcon', 'panda', 'fox', 'heron', 'lynx', 'koala', 'gecko', 'wombat', 'robin'];

export const randomMeetingName = () =>
  `${ADJ[Math.floor(Math.random() * ADJ.length)]}-${NOUN[Math.floor(Math.random() * NOUN.length)]}-${Math.floor(10 + Math.random() * 90)}`;

// Meeting names live in the URL, so keep them simple: lowercase, no spaces or odd characters.
export const cleanMeetingName = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 48);
