import React, { useCallback, useEffect, useRef, useState } from 'react';

type TooltipPosition = {
  top: number;
  left: number;
  width: number;
  arrowLeft: number;
};

const TOOLTIP_MAX_WIDTH_PX = 288;
const TOOLTIP_VIEWPORT_MARGIN_PX = 8;
const TOOLTIP_ARROW_MARGIN_PX = 16;

type Props = {
  children: React.ReactNode;
  tooltip: string;
  align?: 'left' | 'center' | 'right';
};

export function LeaderboardHeaderTooltip({ children, tooltip, align = 'center' }: Props) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const width = Math.min(
      TOOLTIP_MAX_WIDTH_PX,
      Math.max(0, viewportWidth - (TOOLTIP_VIEWPORT_MARGIN_PX * 2))
    );
    const triggerCenter = triggerRect.left + (triggerRect.width / 2);
    const preferredLeft = align === 'left'
      ? triggerRect.left
      : align === 'right'
        ? triggerRect.right - width
        : triggerCenter - (width / 2);
    const maxLeft = Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, viewportWidth - width - TOOLTIP_VIEWPORT_MARGIN_PX);
    const left = Math.min(Math.max(preferredLeft, TOOLTIP_VIEWPORT_MARGIN_PX), maxLeft);

    setPosition({
      top: triggerRect.bottom + TOOLTIP_VIEWPORT_MARGIN_PX,
      left,
      width,
      arrowLeft: Math.min(
        Math.max(triggerCenter - left, TOOLTIP_ARROW_MARGIN_PX),
        Math.max(TOOLTIP_ARROW_MARGIN_PX, width - TOOLTIP_ARROW_MARGIN_PX)
      ),
    });
  }, [align]);

  useEffect(() => {
    if (!isVisible) return undefined;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, updatePosition]);

  const showTooltip = () => {
    updatePosition();
    setIsVisible(true);
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onBlur={() => setIsVisible(false)}
      onFocus={showTooltip}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <span
        aria-hidden={!isVisible}
        className={`pointer-events-none fixed z-[70] transition-opacity ${isVisible && position ? 'visible opacity-100' : 'invisible opacity-0'}`}
        style={{
          left: position ? `${position.left}px` : undefined,
          top: position ? `${position.top}px` : undefined,
          width: position ? `${position.width}px` : undefined,
        }}
      >
        <span className="relative block rounded bg-gray-800 px-3 py-2 text-left text-xs font-medium normal-case leading-snug text-white shadow-lg dark:bg-gray-100 dark:text-black">
          <span
            className="absolute -top-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-800 dark:bg-gray-100"
            style={{ left: position ? `${position.arrowLeft}px` : undefined }}
          />
          {tooltip}
        </span>
      </span>
    </span>
  );
}
