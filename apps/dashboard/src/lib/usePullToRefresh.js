import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Google Chrome-style Pull-to-Refresh Hook
 * 
 * Features:
 * - Damping factor 0.4 for resistance
 * - Threshold 70px
 * - 60fps transform-based animation
 * - Proper cancel behavior
 */
export const usePullToRefresh = (onRefresh) => {
    const [state, setState] = useState('idle'); // idle, pulling, threshold, loading, complete
    const [visualOffset, setVisualOffset] = useState(0);
    const [rotation, setRotation] = useState(0);

    const startY = useRef(0);
    const currentY = useRef(0);
    const isActive = useRef(false);

    const THRESHOLD = 70;
    const DAMPING = 0.4;
    const MAX_PULL = 150;

    const triggerHaptic = useCallback(() => {
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }, []);

    useEffect(() => {
        let animationFrame;

        const updateVisuals = () => {
            if (isActive.current && state !== 'loading') {
                const rawDistance = currentY.current - startY.current;

                if (rawDistance > 0) {
                    // Apply damping factor for resistance effect
                    const dampedDistance = rawDistance * DAMPING;
                    const clampedDistance = Math.min(dampedDistance, MAX_PULL * DAMPING);

                    setVisualOffset(clampedDistance);
                    // Rotation follows pull distance (360 degrees over threshold)
                    setRotation((clampedDistance / (THRESHOLD * DAMPING)) * 360);

                    // Check if reached threshold
                    if (dampedDistance >= THRESHOLD * DAMPING && state === 'pulling') {
                        setState('threshold');
                        triggerHaptic();
                    } else if (dampedDistance < THRESHOLD * DAMPING && state === 'threshold') {
                        setState('pulling');
                    }
                }
            }
            animationFrame = requestAnimationFrame(updateVisuals);
        };

        const handleTouchStart = (e) => {
            if (window.scrollY === 0 && state === 'idle') {
                startY.current = e.touches[0].clientY;
                currentY.current = e.touches[0].clientY;
                isActive.current = true;
                setState('pulling');
            }
        };

        const handleTouchMove = (e) => {
            if (!isActive.current || state === 'loading') return;

            currentY.current = e.touches[0].clientY;
            const rawDistance = currentY.current - startY.current;

            // Only prevent default if pulling down at top
            if (rawDistance > 5 && window.scrollY === 0) {
                e.preventDefault();
            } else if (rawDistance <= 0 || window.scrollY > 0) {
                // Cancel pull
                isActive.current = false;
                setState('idle');
                setVisualOffset(0);
                setRotation(0);
            }
        };

        const handleTouchEnd = async () => {
            if (!isActive.current) return;

            isActive.current = false;

            if (state === 'threshold') {
                // Reached threshold - trigger refresh
                setState('loading');
                setVisualOffset(50); // Hold at 50px during loading

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
                    setTimeout(() => setState('idle'), 300);
                }, 100);
            } else {
                // Didn't reach threshold - cancel
                setState('idle');
                setVisualOffset(0);
                setRotation(0);
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
        opacity: Math.min(visualOffset / 30, 1)
    };
};
