import { forwardRef, useRef, useEffect, useState, useCallback } from 'react';
import { IconDrag } from '@consta/icons/IconDrag';

import styles from './StoryCanvas.module.scss';

export type PlateMode = 'each' | 'block'; // оставлен для совместимости, не используется

export interface StoryStyle {
  overlayOpacity: number;  // 0–100
  showPlate: boolean;
  plateColor: string;      // hex
  plateOpacity: number;    // 0–100
  plateRadius: number;     // 0–24 px
}

export interface Position {
  xPct: number; // % от ширины канваса
  yPct: number; // % от высоты канваса
}

interface StoryCanvasProps {
  imageUrl: string;
  theses: string[];
  editingIndex: number | null;
  storyStyle: StoryStyle;
  positions: Position[];
  onPositionsChange: (positions: Position[]) => void;
  onThesisClick: (index: number) => void;
  onThesisChange: (index: number, value: string) => void;
  onThesisBlur: () => void;
  onThesisRemove: (index: number) => void;
  onAddThesis: () => void;
  isExporting?: boolean;
}

const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const StoryCanvas = forwardRef<HTMLDivElement, StoryCanvasProps>(
  (
    {
      imageUrl,
      theses,
      editingIndex,
      storyStyle,
      positions,
      onPositionsChange,
      onThesisClick,
      onThesisChange,
      onThesisBlur,
      onThesisRemove,
      onAddThesis,
      isExporting = false,
    },
    ref
  ) => {
    const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
    const canvasElRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef<{
      type: 'group' | number;
      startMouseX: number;
      startMouseY: number;
      startPositions: Position[];
    } | null>(null);

    const [draggingType, setDraggingType] = useState<'group' | number | null>(null);

    useEffect(() => {
      if (editingIndex !== null) {
        const el = textareaRefs.current[editingIndex];
        if (el) {
          el.focus();
          el.selectionStart = el.value.length;
        }
      }
    }, [editingIndex]);

    const autoResize = (el: HTMLTextAreaElement) => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };

    const startDragCommon = useCallback(
      (startX: number, startY: number, type: 'group' | number) => {
        const snapshot = positions.map((p) => ({ ...p }));
        dragState.current = { type, startMouseX: startX, startMouseY: startY, startPositions: snapshot };
        setDraggingType(type);

        const applyDelta = (cx: number, cy: number) => {
          if (!dragState.current || !canvasElRef.current) return;
          const rect = canvasElRef.current.getBoundingClientRect();
          const dx = ((cx - dragState.current.startMouseX) / rect.width) * 100;
          const dy = ((cy - dragState.current.startMouseY) / rect.height) * 100;
          const { type: t, startPositions: sp } = dragState.current;
          onPositionsChange(
            t === 'group'
              ? sp.map((p) => ({ xPct: clamp(p.xPct + dx, 0, 95), yPct: clamp(p.yPct + dy, 0, 95) }))
              : sp.map((p, i) =>
                  i === (t as number)
                    ? { xPct: clamp(p.xPct + dx, 0, 95), yPct: clamp(p.yPct + dy, 0, 95) }
                    : p
                )
          );
        };

        const onMove = (e: MouseEvent) => applyDelta(e.clientX, e.clientY);
        const onTMove = (e: TouchEvent) => applyDelta(e.touches[0].clientX, e.touches[0].clientY);
        const onEnd = () => {
          dragState.current = null;
          setDraggingType(null);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onEnd);
          document.removeEventListener('touchmove', onTMove);
          document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onTMove);
        document.addEventListener('touchend', onEnd);
      },
      [positions, onPositionsChange]
    );

    const { overlayOpacity, showPlate, plateColor, plateOpacity, plateRadius } = storyStyle;

    const plateBg = showPlate ? hexToRgba(plateColor, plateOpacity) : undefined;
    const isLight = ['#ffffff', '#f5f5f5', '#ffff00'].includes(plateColor);
    const forceDark = showPlate && isLight && plateOpacity > 40;
    const textColor = forceDark ? '#1a1a1a' : '#ffffff';
    const bulletColor = forceDark ? '#555' : '#f5a623';
    const textShadow = forceDark ? 'none' : '0 1px 4px rgba(0,0,0,0.7)';

    const overlayStyle = {
      background: `linear-gradient(
        to bottom,
        rgba(0,0,0,${(overlayOpacity / 100) * 0.2}) 0%,
        rgba(0,0,0,${(overlayOpacity / 100) * 0.05}) 30%,
        rgba(0,0,0,${(overlayOpacity / 100) * 0.55}) 60%,
        rgba(0,0,0,${overlayOpacity / 100}) 100%
      )`,
    };

    const plateStyle: React.CSSProperties | undefined = showPlate
      ? {
          background: plateBg,
          borderRadius: `${plateRadius}px`,
          padding: '6px 12px',
        }
      : undefined;

    return (
      <div
        className={styles.canvas}
        ref={(el) => {
          canvasElRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
      >
        {imageUrl && <img className={styles.canvas__bg} src={imageUrl} alt="" />}
        <div className={styles.canvas__overlay} style={overlayStyle} />

        {!imageUrl && (
          <div className={styles.placeholder}>Здесь появится ваша история с тезисами</div>
        )}

        {/* Хэндл «Переместить все» */}
        {!isExporting && theses.length > 0 && (
          <div
            className={styles.groupDragHandle}
            onMouseDown={(e) => {
              e.preventDefault();
              startDragCommon(e.clientX, e.clientY, 'group');
            }}
            onTouchStart={(e) => {
              startDragCommon(e.touches[0].clientX, e.touches[0].clientY, 'group');
            }}
            title="Переместить все тезисы"
          >
            <IconDrag size="xs" />
            <span>Переместить все</span>
          </div>
        )}

        {/* Тезисы — каждый на своей позиции */}
        {theses.map((thesis, index) => {
          const pos = positions[index] ?? { xPct: 5, yPct: 55 + index * 9 };
          const isDraggingThis = draggingType === index;

          return (
            <div
              key={index}
              className={styles.thesis}
              style={{
                position: 'absolute',
                left: `${pos.xPct}%`,
                top: `${pos.yPct}%`,
                cursor: isDraggingThis ? 'grabbing' : 'default',
                zIndex: isDraggingThis ? 10 : 1,
              }}
            >
              {!isExporting && (
                <div
                  className={styles.thesis__dragHandle}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    startDragCommon(e.clientX, e.clientY, index);
                  }}
                  onTouchStart={(e) => {
                    startDragCommon(e.touches[0].clientX, e.touches[0].clientY, index);
                  }}
                  title="Переместить тезис"
                >
                  <IconDrag size="xs" />
                </div>
              )}

              <div className={styles.thesis__inner} style={plateStyle}>
                <div className={styles.thesis__bullet} style={{ background: bulletColor }} />

                {editingIndex === index && !isExporting ? (
                  <textarea
                    ref={(el) => {
                      textareaRefs.current[index] = el;
                    }}
                    className={styles.thesis__textarea}
                    value={thesis}
                    rows={2}
                    style={{ color: textColor }}
                    onChange={(e) => {
                      onThesisChange(index, e.target.value);
                      autoResize(e.target);
                    }}
                    onBlur={onThesisBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onThesisBlur();
                      }
                    }}
                  />
                ) : (
                  <p
                    className={styles.thesis__text}
                    style={{ color: textColor, textShadow }}
                    onClick={() => !isExporting && onThesisClick(index)}
                  >
                    {thesis}
                  </p>
                )}
              </div>

              {!isExporting && (
                <button
                  className={styles.thesis__remove}
                  onClick={(e) => {
                    e.stopPropagation();
                    onThesisRemove(index);
                  }}
                  title="Удалить тезис"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        <div className={styles.watermark}>
          Контент сгенерирован с помощью ИИ
        </div>

        {!isExporting && theses.length < 7 && (
          <button className={styles.addThesis} onClick={onAddThesis}>
            + Добавить тезис
          </button>
        )}
      </div>
    );
  }
);

StoryCanvas.displayName = 'StoryCanvas';
