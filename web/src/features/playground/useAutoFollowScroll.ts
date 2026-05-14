import { RefObject, TouchEvent, WheelEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type UseAutoFollowScrollOptions<T extends HTMLElement> = {
  enabled?: boolean;
  followLatest?: boolean;
  onFollowLatestChange?: (following: boolean) => void;
  onScrollToLatestReady?: (handler: (() => void) | null) => void;
  containerRef: RefObject<T | null>;
  resetKey?: string | number | null;
  watch?: readonly unknown[];
};

export function useAutoFollowScroll<T extends HTMLElement = HTMLDivElement>({
  enabled = true,
  followLatest,
  onFollowLatestChange,
  onScrollToLatestReady,
  containerRef,
  resetKey,
  watch = [],
}: UseAutoFollowScrollOptions<T>) {
  const tailRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const followingRef = useRef(true);
  const userPausedRef = useRef(false);
  const [internalFollowLatest, setInternalFollowLatest] = useState(true);
  const following = followLatest ?? internalFollowLatest;

  const setFollowing = useCallback((next: boolean, userPaused = !next) => {
    followingRef.current = next;
    userPausedRef.current = userPaused;
    if (followLatest === undefined) setInternalFollowLatest(next);
    onFollowLatestChange?.(next);
  }, [followLatest, onFollowLatestChange]);

  const getContainer = useCallback(() => {
    return containerRef.current;
  }, [containerRef]);

  const scrollTail = useCallback((behavior: ScrollBehavior) => {
    const container = getContainer();
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    if (behavior === "auto") lastScrollTopRef.current = container.scrollTop;
  }, [getContainer]);

  const scrollToLatest = useCallback(() => {
    setFollowing(true, false);
    scrollTail("smooth");
  }, [scrollTail, setFollowing]);

  useEffect(() => {
    if (resetKey == null) return;
    setFollowing(true, false);
    lastScrollTopRef.current = 0;
    touchStartYRef.current = null;
  }, [resetKey, setFollowing]);

  useEffect(() => {
    const container = enabled ? getContainer() : null;
    if (!container) {
      onScrollToLatestReady?.(null);
      return;
    }

    const syncFollowing = () => {
      const scrollingUp = container.scrollTop < lastScrollTopRef.current - 2;
      lastScrollTopRef.current = container.scrollTop;
      if (scrollingUp) {
        setFollowing(false);
        return;
      }
      if (isNearScrollTail(container)) setFollowing(true, false);
    };

    onScrollToLatestReady?.(scrollToLatest);
    container.addEventListener("scroll", syncFollowing, { passive: true });
    return () => {
      container.removeEventListener("scroll", syncFollowing);
      onScrollToLatestReady?.(null);
    };
  }, [enabled, getContainer, onScrollToLatestReady, resetKey, scrollToLatest, setFollowing, ...watch]);

  useLayoutEffect(() => {
    if (!enabled || !followingRef.current) return;
    scrollTail("auto");
    const frame = window.requestAnimationFrame(() => scrollTail("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, following, scrollTail, ...watch]);

  const pauseFollowing = useCallback(() => {
    if (followingRef.current || !userPausedRef.current) setFollowing(false, true);
  }, [setFollowing]);

  const handleWheel = useCallback((event: WheelEvent<T>) => {
    if (event.deltaX !== 0 || event.deltaY !== 0) pauseFollowing();
  }, [pauseFollowing]);

  const handleTouchStart = useCallback((event: TouchEvent<T>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<T>) => {
    const startY = touchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (startY != null && currentY != null && Math.abs(currentY - startY) > 2) pauseFollowing();
  }, [pauseFollowing]);

  return {
    following,
    tailRef,
    scrollToLatest,
    scrollHandlers: {
      onWheel: handleWheel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
    },
  };
}

function isNearScrollTail(container: HTMLElement) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < 8;
}
