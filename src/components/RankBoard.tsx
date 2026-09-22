'use client';

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { QuestionOption } from '@/lib/game';
import { handOf, place, placedCount, returnToHand, type Slots } from '@/lib/ui/board';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import styles from './RankBoard.module.css';

type Props = {
  options: readonly QuestionOption[];
  /** ลำดับไพ่ในมือตั้งต้น (สุ่มจาก server) */
  layout: readonly string[];
  slots: Slots;
  topLabel: string;
  bottomLabel: string;
  /** ชื่อกลุ่มสำหรับ screen reader เช่น "อันดับของฉัน" */
  label: string;
  /** ไม่ส่ง = อ่านอย่างเดียว (ล็อกแล้ว / ดูสด) */
  onChange?: (next: (string | null)[]) => void;
  disabled?: boolean;
  /** ปุ่มยืนยัน/สถานะ — อยู่ในถาดล่างจอเดียวกับไพ่ในมือ */
  footer?: ReactNode;
  /** ข้อความหัวถาด (แทนคำแนะนำตั้งต้น) เช่น “👀 คู่หูกำลังดูอยู่” */
  trayNote?: ReactNode;
};

const HAND = 'hand';
const slotId = (i: number) => `slot-${i}`;

/**
 * แท่นอันดับ + ไพ่ในมือ
 * วิธีหลักคือแตะ: แตะไพ่ → แตะช่อง (ใช้ได้ทั้งนิ้ว เมาส์ และคีย์บอร์ดเพราะทุกชิ้นเป็นปุ่ม)
 * ลากได้ด้วย: เมาส์ลากทันที, นิ้วกดค้างสั้น ๆ ก่อนลาก เพื่อไม่แย่งการเลื่อนหน้า
 */
export function RankBoard({ options, layout, slots, topLabel, bottomLabel, label, onChange, disabled, footer, trayNote }: Props) {
  const dndId = useId();
  const reducedMotion = useReducedMotion();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const flyFromRef = useRef<{ id: string; rect: DOMRect } | null>(null);
  // หลังลากเสร็จ เบราว์เซอร์ยังยิง click ตามมา — กันไม่ให้ไปเลือกไพ่ซ้ำ
  const suppressClick = useRef(false);

  const editable = Boolean(onChange) && !disabled;
  const hand = handOf(layout, slots);
  const selectedOnBoard = selected !== null && slots.includes(selected);
  const nameOf = (id: string) => byId.get(id)?.label ?? '';

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  function commit(next: (string | null)[], message: string) {
    onChange?.(next);
    setSelected(null);
    const left = next.length - placedCount(next);
    setAnnouncement(`${message}${left ? ` · เหลือในมือ ${left} ใบ` : ' · วางครบแล้ว'}`);
  }

  function rememberOrigin(id: string) {
    const el = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
    flyFromRef.current = el && !reducedMotion ? { id, rect: el.getBoundingClientRect() } : null;
  }

  function onSlot(i: number) {
    if (!editable || suppressClick.current) return;
    const occupant = slots[i] ?? null;
    if (selected) {
      if (selected === occupant) return setSelected(null);
      rememberOrigin(selected);
      commit(place(slots, selected, i), `วาง ${nameOf(selected)} ที่อันดับ ${i + 1}`);
    } else if (occupant) {
      setSelected(occupant);
    }
  }

  function onHandCard(id: string) {
    if (!editable || suppressClick.current) return;
    setSelected((s) => (s === id ? null : id));
  }

  function backToHand() {
    if (!selected || !selectedOnBoard) return;
    commit(returnToHand(slots, selected), `เก็บ ${nameOf(selected)} คืนมือ`);
  }

  function onDragStart(e: DragStartEvent) {
    setDragging(String(e.active.id));
    setSelected(null);
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setDragging(null);
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 250);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    if (over === HAND) {
      if (slots.includes(id)) commit(returnToHand(slots, id), `เก็บ ${nameOf(id)} คืนมือ`);
      return;
    }
    const i = Number(over.replace('slot-', ''));
    commit(place(slots, id, i), `วาง ${nameOf(id)} ที่อันดับ ${i + 1}`);
  }

  const board = (
    <div className={styles.root}>
      <p className={styles.legend}>
        <span className={styles.legendChip}>
          <strong>1</strong> = {topLabel}
        </span>
        <span className={styles.legendChip}>
          <strong>5</strong> = {bottomLabel}
        </span>
      </p>

      <div className={styles.podium} role="group" aria-label={label}>
        {slots.map((id, i) => (
          <Slot
            key={i}
            index={i}
            option={id ? byId.get(id) : undefined}
            editable={editable}
            selected={id !== null && id === selected}
            targeting={editable && selected !== null && id !== selected}
            hidden={id !== null && id === dragging}
            flyFromRef={flyFromRef}
            onClick={() => onSlot(i)}
          />
        ))}
      </div>

      {(editable || footer) && (
        // ถาดล่างจอ: ไพ่ในมือ + ปุ่มยืนยัน ติดขอบล่างบนมือถือเหมือนเกมไพ่ ไม่ต้องเลื่อนหา
        <div className={styles.tray}>
      {editable && (
        <HandArea
          active={selectedOnBoard}
          empty={hand.length === 0}
          note={trayNote}
          onClick={backToHand}
          action={
            selectedOnBoard ? (
              <button type="button" className={styles.returnButton} onClick={backToHand}>
                ↩ เอา “{nameOf(selected!)}” คืนมือ
              </button>
            ) : null
          }
        >
          {hand.map((id, i) => (
            <HandCard
              key={id}
              option={byId.get(id)!}
              index={i}
              count={hand.length}
              selected={id === selected}
              hidden={id === dragging}
              onClick={() => onHandCard(id)}
            />
          ))}
        </HandArea>
      )}
          {footer}
        </div>
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );

  if (!editable) return board;
  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      {board}
      <DragOverlay dropAnimation={reducedMotion ? null : { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {dragging && byId.get(dragging) ? <CardFace option={byId.get(dragging)!} lifted /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------

function Slot({
  index,
  option,
  editable,
  selected,
  targeting,
  hidden,
  flyFromRef,
  onClick,
}: {
  index: number;
  option: QuestionOption | undefined;
  editable: boolean;
  selected: boolean;
  targeting: boolean;
  hidden: boolean;
  flyFromRef: RefObject<{ id: string; rect: DOMRect } | null>;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(index), disabled: !editable });
  const rank = index + 1;
  const cls = [
    styles.slot,
    styles[`rank${rank}`],
    option ? styles.filled : styles.empty,
    targeting ? styles.targeting : '',
    isOver ? styles.over : '',
  ].join(' ');

  const content = option ? (
    <DraggableCard option={option} editable={editable} selected={selected} hidden={hidden} flyFromRef={flyFromRef} />
  ) : (
    <span className={styles.slotNumber} aria-hidden="true">
      {rank}
    </span>
  );

  return (
    <div ref={setNodeRef} className={cls}>
      {editable ? (
        <button
          type="button"
          className={styles.slotButton}
          onClick={onClick}
          aria-pressed={selected}
          aria-label={option ? `อันดับ ${rank}: ${option.label}${selected ? ' (เลือกอยู่)' : ''}` : `อันดับ ${rank}: ว่าง`}
        >
          {content}
        </button>
      ) : (
        <div className={styles.slotButton} aria-label={option ? `อันดับ ${rank}: ${option.label}` : `อันดับ ${rank}: ว่าง`} role="img">
          {content}
        </div>
      )}
      <span className={styles.plinth} aria-hidden="true">
        {rank === 1 ? '★ 1' : rank}
      </span>
    </div>
  );
}

function HandArea({
  children,
  active,
  empty,
  onClick,
  action,
  note,
}: {
  children: ReactNode;
  active: boolean;
  empty: boolean;
  note?: ReactNode;
  onClick: () => void;
  action: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: HAND });
  return (
    <div className={styles.handWrap}>
      <p className={styles.handTitle}>
        {note ? <>{note} · </> : null}
        {empty ? 'วางครบแล้ว · แตะไพ่บนแท่นเพื่อสลับ' : 'แตะไพ่ แล้วแตะช่องบนแท่น'}
      </p>
      <div
        ref={setNodeRef}
        className={`${styles.hand} ${isOver || active ? styles.handActive : ''}`}
        // แตะพื้นที่ว่างของมือตอนเลือกไพ่บนแท่นอยู่ = เก็บคืนมือ
        onClick={(e) => {
          if (e.target === e.currentTarget && active) onClick();
        }}
      >
        {children}
      </div>
      {action}
    </div>
  );
}

function HandCard({
  option,
  index,
  count,
  selected,
  hidden,
  onClick,
}: {
  option: QuestionOption;
  index: number;
  count: number;
  selected: boolean;
  hidden: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: option.id });
  // คลี่เป็นพัด: เอียงและต่ำลงตามระยะจากกึ่งกลาง
  const offset = index - (count - 1) / 2;
  const style = { '--rot': `${offset * 6}deg`, '--drop': `${Math.abs(offset) * 5}px` } as CSSProperties;
  return (
    <button
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      type="button"
      className={`${styles.handCard} ${selected ? styles.picked : ''} ${hidden ? styles.ghost : ''}`}
      style={style}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`ไพ่ “${option.label}” ในมือ${selected ? ' (เลือกอยู่ แตะช่องบนแท่นเพื่อวาง)' : ''}`}
      data-card-id={option.id}
      role={undefined}
      tabIndex={0}
    >
      <CardFace option={option} small />
    </button>
  );
}

function DraggableCard({
  option,
  editable,
  selected,
  hidden,
  flyFromRef,
}: {
  option: QuestionOption;
  editable: boolean;
  selected: boolean;
  hidden: boolean;
  flyFromRef: RefObject<{ id: string; rect: DOMRect } | null>;
}) {
  const { listeners, setNodeRef } = useDraggable({ id: option.id, disabled: !editable });
  const ref = useRef<HTMLSpanElement | null>(null);

  // ไพ่บินจากมือลงช่อง (FLIP) — ใช้ transform อย่างเดียว
  useLayoutEffect(() => {
    const from = flyFromRef.current;
    const el = ref.current;
    if (!from || from.id !== option.id || !el) return;
    flyFromRef.current = null;
    const to = el.getBoundingClientRect();
    const dx = from.rect.left + from.rect.width / 2 - (to.left + to.width / 2);
    const dy = from.rect.top + from.rect.height / 2 - (to.top + to.height / 2);
    const s = from.rect.width / to.width;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-6deg)` }, { transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  });

  // ไม่ต่อ listener ของ dnd-kit กับปุ่มช่อง เพื่อให้ onClick ของปุ่มทำงานตามปกติ
  return (
    <span
      ref={(el) => {
        ref.current = el;
        setNodeRef(el);
      }}
      className={`${styles.placed} ${selected ? styles.picked : ''} ${hidden ? styles.ghost : ''}`}
      data-card-id={option.id}
      {...(editable ? listeners : {})}
    >
      <CardFace option={option} />
    </span>
  );
}

export function CardFace({ option, small, lifted }: { option: QuestionOption; small?: boolean; lifted?: boolean }) {
  return (
    <span className={`${styles.card} ${small ? styles.small : ''} ${lifted ? styles.lifted : ''}`}>
      <span className={styles.art} aria-hidden="true">
        {option.icon ?? '🃏'}
      </span>
      <span className={styles.name}>{option.label}</span>
    </span>
  );
}

/** แท่นอ่านอย่างเดียว (หน้าดูสดของคนวาง) — ไพ่ที่ยังไม่วางแสดงเป็นช่องว่าง */
export function PodiumView({ options, slots, label }: { options: readonly QuestionOption[]; slots: Slots; label: string }) {
  const byId = new Map(options.map((o) => [o.id, o]));
  return (
    <div className={styles.podium} role="group" aria-label={label}>
      {slots.map((id, i) => {
        const option = id ? byId.get(id) : undefined;
        return (
          <div
            key={i}
            className={`${styles.slot} ${styles[`rank${i + 1}`]} ${option ? styles.filled : styles.empty}`}
          >
            <div className={styles.slotButton} role="img" aria-label={option ? `อันดับ ${i + 1}: ${option.label}` : `อันดับ ${i + 1}: ว่าง`}>
              {option ? (
                <span key={option.id} className={`${styles.placed} ${styles.dropIn}`}>
                  <CardFace option={option} />
                </span>
              ) : (
                <span className={styles.slotNumber} aria-hidden="true">
                  {i + 1}
                </span>
              )}
            </div>
            <span className={styles.plinth} aria-hidden="true">
              {i === 0 ? '★ 1' : i + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}
