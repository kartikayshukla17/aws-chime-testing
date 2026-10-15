import Room from '@/components/Room';

export default function RoomPage({ params }: { params: { room: string } }) {
  return <Room room={decodeURIComponent(params.room)} />;
}
