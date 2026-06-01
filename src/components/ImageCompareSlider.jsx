import { useState, useRef, useCallback } from "react";
import "../styles/imageCompareSlider.css";

export default function ImageCompareSlider({
  imageLeft,
  imageRight,
  altLeft = "",
  altRight = "",
  labelLeft = "",
  labelRight = "",
  initialPosition = 0.5,
}) {
  const [position, setPosition] = useState(initialPosition);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  }, []);

  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    updatePosition(e.clientX);
  };

  const onMouseMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const stopDrag = () => {
    dragging.current = false;
  };

  const onTouchStart = (e) => {
    dragging.current = true;
    updatePosition(e.touches[0].clientX);
  };

  const onTouchMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );

  const pct = position * 100;

  return (
    <div
      ref={containerRef}
      className="ics-container"
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={onTouchMove}
      onTouchEnd={stopDrag}
    >
      <img src={imageRight} alt={altRight} draggable={false} className="ics-img-right" />

      <img
        src={imageLeft}
        alt={altLeft}
        draggable={false}
        className="ics-img-left"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      />

      {labelLeft && (
        <span className="ics-label ics-label-left">{labelLeft}</span>
      )}
      {labelRight && (
        <span className="ics-label ics-label-right">{labelRight}</span>
      )}

      <div
        className="ics-divider"
        style={{ left: `${pct}%` }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="ics-handle">
          <svg width="9" height="13" viewBox="0 0 9 13" fill="none">
            <path d="M7 1L1.5 6.5L7 12" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg width="9" height="13" viewBox="0 0 9 13" fill="none">
            <path d="M2 1L7.5 6.5L2 12" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
