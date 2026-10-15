import Dashboard from '@/components/Dashboard';

export default function DashboardPage({ params }: { params: { room: string } }) {
  return <Dashboard room={decodeURIComponent(params.room)} />;
}
