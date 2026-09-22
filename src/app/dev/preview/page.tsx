import { notFound } from 'next/navigation';
import { DevPreview } from '@/features/dev/DevPreview';

/**
 * หน้าตรวจ UI สำหรับนักพัฒนาเท่านั้น — ใช้ถ่ายภาพหน้าจอทุก phase ที่ 360/768/1440 px
 * state สร้างจาก reducer + projection ตัวจริง ไม่ได้ต่อ backend และ **ไม่มีใน production build**
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  return (
    <DevPreview
      screen={params.screen ?? 'lobby'}
      longNames={params.long === '1'}
      // ค่าเริ่มต้นเหมือนเว็บจริง (ธีมโต๊ะ) · ?skin=classic เพื่อดูแบบเดิมเทียบ
      skin={params.skin === 'classic' ? undefined : 'table'}
      submit={params.submit === 'fail' || params.submit === 'slow' ? params.submit : undefined}
    />
  );
}
