'use client';

import { useEffect, useState } from 'react';
import type { Question, ScoreResult } from '@/lib/game';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import styles from './reveal.module.css';

type Props = {
  question: Question;
  score: ScoreResult;
  /** ชื่อของคนที่ถูกทาย — ใช้ในคำอธิบายแถว */
  subjectName: string;
  /** เปิดทีละใบ (ครั้งแรกที่เข้าหน้าเฉลย) หรือแสดงทั้งหมดทันที */
  animate: boolean;
  onAllShown?: () => void;
};

const STEP_MS = 320;

const VERDICT = {
  2: { icon: '🎯', text: 'ตรงเป๊ะ', cls: 'exact' },
  1: { icon: '👌', text: 'ใกล้มาก', cls: 'near' },
  0: { icon: '💨', text: 'พลาด', cls: 'miss' },
} as const;

/**
 * เฉลยรายการ์ด เรียงตามอันดับจริงของคนที่ถูกทาย
 * แต่ละแถวบอกผลเป็นข้อความเต็ม เช่น “เน็ตหลุด: ทายอันดับ 2 / จริงอันดับ 3 / +1”
 * เพื่อไม่ให้เข้าใจคะแนนผิดจากการวางแถวเทียบตำแหน่ง (plan.md §4.4)
 */
export function RevealBreakdown({ question, score, subjectName, animate, onAllShown }: Props) {
  const reducedMotion = useReducedMotion();
  const total = score.breakdown.length;
  const [shown, setShown] = useState(animate && !reducedMotion ? 0 : total);

  useEffect(() => {
    if (shown >= total) {
      onAllShown?.();
      return;
    }
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 150 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, total, onAllShown]);

  const byId = new Map(question.options.map((o) => [o.id, o]));

  return (
    <div className={styles.breakdown}>
      <ol className={styles.rows} aria-label={`อันดับจริงของ${subjectName} เทียบกับคำทาย`}>
        {score.breakdown.map((entry, i) => {
          const option = byId.get(entry.optionId)!;
          const verdict = VERDICT[entry.points as 0 | 1 | 2];
          const visible = i < shown;
          return (
            <li key={entry.optionId} className={`${styles.row} ${visible ? styles.rowShown : styles.rowHidden}`}>
              {visible ? (
                <>
                  <span className={styles.actualRank} aria-hidden="true">
                    {entry.actualIndex + 1}
                  </span>
                  <span className={styles.optIcon} aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.optLabel}>{option.label}</span>
                    <span className={styles.detail}>
                      ทายอันดับ {entry.guessedIndex + 1} / จริงอันดับ {entry.actualIndex + 1}
                    </span>
                  </span>
                  <span className={`${styles.verdict} ${styles[verdict.cls]}`}>
                    <span aria-hidden="true">{verdict.icon}</span>
                    <span>
                      {verdict.text} <strong>+{entry.points}</strong>
                    </span>
                  </span>
                </>
              ) : (
                <span className={styles.faceDown} aria-hidden="true">
                  <span>{entry.actualIndex + 1}</span>
                  <span className={styles.faceDownMark}>?</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {shown < total && (
        <button type="button" className={styles.skip} onClick={() => setShown(total)}>
          ดูทั้งหมด ⏭
        </button>
      )}
    </div>
  );
}
