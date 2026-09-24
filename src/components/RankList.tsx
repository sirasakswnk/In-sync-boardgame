'use client';

import { OptionIcon } from '@/components/OptionIcon';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { QuestionOption } from '@/lib/game';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import styles from './RankList.module.css';

type Props = {
  options: readonly QuestionOption[];
  order: readonly string[];
  topLabel: string;
  bottomLabel: string;
  /** ชื่อของรายการสำหรับ screen reader เช่น "อันดับของฉัน" */
  label: string;
  /** ไม่ส่ง = อ่านอย่างเดียว */
  onChange?: (next: string[]) => void;
  disabled?: boolean;
};

const lockVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const animateAlways: AnimateLayoutChanges = (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true });

/**
 * รายการการ์ดที่เรียงได้ 3 ทาง: ลาก (mouse/touch ผ่าน handle), คีย์บอร์ด (Space + ลูกศร), ปุ่มขึ้น/ลง
 * ตัวเลขอันดับอยู่กับ "ตำแหน่ง" ไม่วิ่งตามการ์ด (plan.md §6.3)
 */
export function RankList({ options, order, topLabel, bottomLabel, label, onChange, disabled }: Props) {
  const dndId = useId();
  const reducedMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const buttons = useRef(new Map<string, { up: HTMLButtonElement | null; down: HTMLButtonElement | null }>());
  const nameOf = useCallback((id: unknown) => byId.get(String(id))?.label ?? '', [byId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const editable = Boolean(onChange) && !disabled;

  const move = useCallback(
    (id: string, delta: -1 | 1) => {
      if (!onChange) return;
      const from = order.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= order.length) return;
      onChange(arrayMove([...order], from, to));
      setAnnouncement(`ย้าย “${nameOf(id)}” ไปอันดับ ${to + 1}`);
      // ถึงขอบแล้วปุ่มเดิมจะ disabled: ย้ายโฟกัสไปปุ่มอีกทางของการ์ดเดิม ไม่ให้โฟกัสหลุด
      requestAnimationFrame(() => {
        const b = buttons.current.get(id);
        if (to === 0) b?.down?.focus();
        else if (to === order.length - 1) b?.up?.focus();
      });
    },
    [onChange, order, nameOf],
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) => `ยก “${nameOf(active.id)}” จากอันดับ ${order.indexOf(String(active.id)) + 1}`,
    onDragOver: ({ active, over }) =>
      over ? `“${nameOf(active.id)}” อยู่เหนืออันดับ ${order.indexOf(String(over.id)) + 1}` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `วาง “${nameOf(active.id)}” ที่อันดับ ${order.indexOf(String(over.id)) + 1}` : `วาง “${nameOf(active.id)}”`,
    onDragCancel: ({ active }) => `ยกเลิกการย้าย “${nameOf(active.id)}”`,
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!onChange || !over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove([...order], from, to));
  }

  const activeOption = activeId ? byId.get(activeId) : undefined;

  return (
    <div className={styles.board}>
      <p className={styles.end}>
        <span className={styles.endIcon} aria-hidden="true">▲</span>
        {topLabel}
      </p>

      <div className={styles.grid}>
        <ol className={styles.numbers} aria-hidden="true">
          {order.map((_, i) => (
            <li key={i} className={styles.number}>
              {i + 1}
            </li>
          ))}
        </ol>

        {editable ? (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[lockVertical]}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  'กด Space หรือ Enter เพื่อยกการ์ด ใช้ลูกศรขึ้นลงเพื่อย้าย แล้วกด Space อีกครั้งเพื่อวาง หรือ Escape เพื่อยกเลิก',
              },
            }}
          >
            <SortableContext items={[...order]} strategy={verticalListSortingStrategy}>
              <ul className={styles.cards} aria-label={label}>
                {order.map((id, i) => (
                  <SortableCard
                    key={id}
                    option={byId.get(id)!}
                    index={i}
                    count={order.length}
                    reducedMotion={reducedMotion}
                    onMove={move}
                    registerButtons={(b) => buttons.current.set(id, b)}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={reducedMotion ? null : { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
              {activeOption ? <CardFace option={activeOption} lifted /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <ul className={styles.cards} aria-label={label}>
            {order.map((id) => (
              <li key={id} className={styles.item}>
                <CardFace option={byId.get(id)!} locked={!onChange || disabled} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className={styles.end}>
        <span className={styles.endIcon} aria-hidden="true">▼</span>
        {bottomLabel}
      </p>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

type CardProps = {
  option: QuestionOption;
  index: number;
  count: number;
  reducedMotion: boolean;
  onMove: (id: string, delta: -1 | 1) => void;
  registerButtons: (b: { up: HTMLButtonElement | null; down: HTMLButtonElement | null }) => void;
};

function SortableCard({ option, index, count, reducedMotion, onMove, registerButtons }: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
    animateLayoutChanges: animateAlways,
    transition: reducedMotion ? null : { duration: 190, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  });
  const up = useRef<HTMLButtonElement | null>(null);
  const down = useRef<HTMLButtonElement | null>(null);

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: reducedMotion ? undefined : transition,
  };

  const bind = () => registerButtons({ up: up.current, down: down.current });

  return (
    <li ref={setNodeRef} style={style} className={`${styles.item} ${isDragging ? styles.placeholder : ''}`}>
      <CardFace
        option={option}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={styles.handle}
            {...attributes}
            {...listeners}
            aria-label={`ลาก “${option.label}” (ตอนนี้อันดับ ${index + 1})`}
          >
            <span className={styles.icon} aria-hidden="true">
              <OptionIcon icon={option.icon} fallback="•" />
            </span>
            <span className={styles.grip} aria-hidden="true" />
          </button>
        }
        controls={
          <span className={styles.arrows}>
            <button
              type="button"
              ref={(el) => {
                up.current = el;
                bind();
              }}
              className={styles.arrow}
              onClick={() => onMove(option.id, -1)}
              disabled={index === 0}
              aria-label={`เลื่อน “${option.label}” ขึ้น`}
            >
              <ArrowIcon dir="up" />
            </button>
            <button
              type="button"
              ref={(el) => {
                down.current = el;
                bind();
              }}
              className={styles.arrow}
              onClick={() => onMove(option.id, 1)}
              disabled={index === count - 1}
              aria-label={`เลื่อน “${option.label}” ลง`}
            >
              <ArrowIcon dir="down" />
            </button>
          </span>
        }
      />
    </li>
  );
}

function CardFace({
  option,
  handle,
  controls,
  lifted,
  locked,
}: {
  option: QuestionOption;
  handle?: ReactNode;
  controls?: ReactNode;
  lifted?: boolean;
  locked?: boolean;
}) {
  return (
    <div className={`${styles.card} ${lifted ? styles.lifted : ''} ${locked ? styles.locked : ''}`}>
      {handle ?? (
        <span className={styles.handleStatic} aria-hidden="true">
          <span className={styles.icon}>
            <OptionIcon icon={option.icon} fallback="•" />
          </span>
          {lifted && <span className={styles.grip} />}
        </span>
      )}
      <span className={styles.label} title={option.label}>
        {option.label}
      </span>
      {controls}
    </div>
  );
}

function ArrowIcon({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d={dir === 'up' ? 'M10 5l-6 6.5h12L10 5z' : 'M10 15l6-6.5H4L10 15z'}
        fill="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}
