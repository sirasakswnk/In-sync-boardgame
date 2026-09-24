import Image from 'next/image';
import styles from './OptionIcon.module.css';

/** ไอคอนที่เป็นรูปวาดเอง: path ใน public/icons เช่น "/icons/q31-o1.svg" — อย่างอื่นถือเป็นอีโมจิ */
export function isImageIcon(icon: string | undefined): icon is string {
  return Boolean(icon?.startsWith('/'));
}

/**
 * ไอคอนของตัวเลือกบนการ์ด — อีโมจิหรือรูปวาดเอง ใช้ปนกันในคำถามเดียวกันได้
 * รูปมีขนาดตาม font-size ของกล่องที่ครอบ เหมือนอีโมจิ จึงวางแทนกันได้ทุกที่โดยไม่ต้องแก้ layout
 * เป็นภาพตกแต่งเสมอ (ชื่อตัวเลือกอยู่ข้าง ๆ แล้ว) จึงใช้ alt ว่าง
 */
export function OptionIcon({ icon, fallback = '🃏' }: { icon: string | undefined; fallback?: string }) {
  if (isImageIcon(icon)) {
    // unoptimized: เสิร์ฟไฟล์ตรงจาก public — SVG ไม่ต้องผ่านตัวแปลงภาพ และไม่กินโควตา image optimization ของ Vercel
    return <Image src={icon} alt="" width={64} height={64} unoptimized draggable={false} className={styles.img} />;
  }
  return <>{icon ?? fallback}</>;
}
