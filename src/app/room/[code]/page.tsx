import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { roomCodeSchema } from '@/lib/game';
import { RoomScreen } from '@/features/room/RoomScreen';
import { RoomProblem } from '@/features/room/RoomStates';

type Props = { params: Promise<{ code: string }> };

export const metadata: Metadata = {
  title: 'ห้องเกม · ใจตรงกันแค่ไหน',
};

export default async function RoomPage({ params }: Props) {
  const { code: raw } = await params;
  const parsed = roomCodeSchema.safeParse(raw);
  if (!parsed.success) return <RoomProblem code="ROOM_NOT_FOUND" />;
  // ลิงก์ที่พิมพ์ตัวเล็กมา ให้ใช้รูปแบบมาตรฐานเดียว
  if (parsed.data !== raw) redirect(`/room/${parsed.data}`);
  return <RoomScreen code={parsed.data} />;
}
