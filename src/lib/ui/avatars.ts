import type { AvatarId } from '@/lib/game';

/** อวาตาร์สำเร็จรูป: อีโมจิบนวงกลมสีพาสเทล — ไม่ต้องโหลดรูปภายนอก */
export const AVATARS: Record<AvatarId, { emoji: string; label: string; bg: string }> = {
  cat: { emoji: '🐱', label: 'แมว', bg: '#ffe3e0' },
  dog: { emoji: '🐶', label: 'หมา', bg: '#fff1d6' },
  bunny: { emoji: '🐰', label: 'กระต่าย', bg: '#fde7f3' },
  bear: { emoji: '🐻', label: 'หมี', bg: '#f3e6da' },
  fox: { emoji: '🦊', label: 'จิ้งจอก', bg: '#ffe6cc' },
  panda: { emoji: '🐼', label: 'แพนด้า', bg: '#eceaf3' },
  frog: { emoji: '🐸', label: 'กบ', bg: '#e1f3ef' },
  owl: { emoji: '🦉', label: 'นกฮูก', bg: '#efe6dc' },
  penguin: { emoji: '🐧', label: 'เพนกวิน', bg: '#e3effa' },
  tiger: { emoji: '🐯', label: 'เสือ', bg: '#fff1d6' },
  koala: { emoji: '🐨', label: 'โคอาลา', bg: '#eeeafd' },
  duck: { emoji: '🦆', label: 'เป็ด', bg: '#e6f4dc' },
};
