import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Google Chrome-style Pull-to-Refresh Hook
 * 
 * Features:
 * - Higher threshold (100px) to prevent accidental refresh
 * - Damping factor for resistance
 * - Deliberate pull required (not just any touch at top)
 * - State machine for proper UX
 */
export const usePullToRefresh = (onRefresh) => {
    const [state, setState] = useState('idle'); // idle, pulling, threshold, loading, complete
    const [visualOffset, setVisualOffset] = useState(0);
    const [rotation, setRotation] = useState(0);

    const startY = useRef(0);
    const currentY = useRef(0);
    const isActive = useRef(false);
    const pullStartedAtTop = useRef(false);
    const hasReachedThreshold = useRef(false);

    // Increased threshold to prevent accidental triggers
    const THRESHOLD = 100;
    const DAMPING = 0.35;
    const MAX_PULL = 180;
    const MIN_PULL_TO_START = 15; // Minimum pull distance to start showing indicator

    const triggerHaptic = useCallback(() => {
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    }, []);

    useEffect(() => {
        let animationFrame;

        const updateVisuals = () => {
            if (isActive.current && pullStartedAtTop.current && state !== 'loading' && state !== 'complete') {
                const rawDistance = currentY.current - startY.current;

                if (rawDistance > MIN_PULL_TO_START) {
                    // Apply damping factor for resistance effect
                    const dampedDistance = rawDistance * DAMPING;
                    const clampedDistance = Math.min(dampedDistance, MAX_PULL * DAMPING);

                    setVisualOffset(clampedDistance);
                    // Rotation follows pull distance
                    setRotation((clampedDistance / (THRESHOLD * DAMPING)) * 360);

                    // Check if reached threshold
                    if (dampedDistance >= THRESHOLD * DAMPING) {
                        if (!hasReachedThreshold.current) {
                            hasReachedThreshold.current = true;
                            setState('threshold');
                            triggerHaptic();
                        }
                    } else {
                        hasReachedThreshold.current = false;
                        if (state === 'threshold') {
                            setState('pulling');
                        }
                    }
                } else if (rawDistance <= 0) {
                    setVisualOffset(0);
                    setRotation(0);
                }
            }
            animationFrame = requestAnimationFrame(updateVisuals);
        };

        const handleTouchStart = (e) => {
            // Only start tracking if at the very top
            if (window.scrollY <= 0 && state === 'idle') {
                startY.current = e.touches[0].clientY;
                currentY.current = e.touches[0].clientY;
                pullStartedAtTop.current = true;
                isActive.current = true;
                hasReachedThreshold.current = false;
            } else {
                pullStartedAtTop.current = false;
                isActive.current = false;
            }
        };

        const handleTouchMove = (e) => {
            if (!isActive.current || !pullStartedAtTop.current || state === 'loading') return;

            currentY.current = e.touches[0].clientY;
            const rawDistance = currentY.current - startY.current;

            // Only prevent default and show indicator if:
            // 1. Started at top
            // 2. Pulling down significantly
            // 3. Still at top of page
            if (rawDistance > MIN_PULL_TO_START && window.scrollY <= 0) {
                e.preventDefault();
                if (state === 'idle') {
                    setState('pulling');
                }
            } else if (rawDistance <= 0 || window.scrollY > 0) {
                // User scrolled up or page scrolled - cancel
                isActive.current = false;
                pullStartedAtTop.current = false;
                hasReachedThreshold.current = false;
                setState('idle');
                setVisualOffset(0);
                setRotation(0);
            }
        };

        const handleTouchEnd = async () => {
            if (!isActive.current || !pullStartedAtTop.current) {
                setVisualOffset(0);
                setRotation(0);
                setState('idle');
                return;
            }

            isActive.current = false;
            pullStartedAtTop.current = false;

            if (hasReachedThreshold.current && state === 'threshold') {
                // Reached threshold - trigger refresh
                setState('loading');
                setVisualOffset(45); // Hold at comfortable position during loading

                try {
                    await onRefresh();
                } catch (e) {
                    console.error('Refresh error:', e);
                }

                setState('complete');
                // Animate out
                setTimeout(() => {
                    setVisualOffset(0);
                    setRotation(0);
                    hasReachedThreshold.current = false;
                    setTimeout(() => setState('idle'), 300);
                }, 100);
            } else {
                // Didn't reach threshold - cancel with animation
                setState('idle');
                setVisualOffset(0);
                setRotation(0);
                hasReachedThreshold.current = false;
            }

            startY.current = 0;
            currentY.current = 0;
        };

        animationFrame = requestAnimationFrame(updateVisuals);

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            cancelAnimationFrame(animationFrame);
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, state, triggerHaptic]);

    return {
        state,
        visualOffset,
        rotation,
        isVisible: state !== 'idle',
        isLoading: state === 'loading',
        isThreshold: state === 'threshold',
        opacity: Math.min(visualOffset / 20, 1),
        progress: Math.min(visualOffset / (THRESHOLD * DAMPING), 1)
    };
};
