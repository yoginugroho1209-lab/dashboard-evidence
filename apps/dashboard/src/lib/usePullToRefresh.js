import { useState, useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh, threshold = 120) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isActive = useRef(false);
    const touchStartScrollY = useRef(0);

    useEffect(() => {
        let animationFrame;

        const updatePull = () => {
            if (isActive.current && !isRefreshing) {
                const distance = currentY.current - startY.current;
                if (distance > 0) {
                    const easedDistance = Math.pow(distance, 0.7);
                    setPullDistance(easedDistance);
                } else {
                    setPullDistance(0);
                }
            }
            animationFrame = requestAnimationFrame(updatePull);
        };

        const handleTouchStart = (e) => {
            touchStartScrollY.current = window.scrollY;
            startY.current = e.touches[0].clientY;
            currentY.current = e.touches[0].clientY;
            // Only activate pull-to-refresh if we're at the very top
            isActive.current = window.scrollY === 0;
        };

        const handleTouchMove = (e) => {
            currentY.current = e.touches[0].clientY;
            const distance = currentY.current - startY.current;

            // Only prevent scroll if:
            // 1. We started at top (scrollY was 0 when touch started)
            // 2. We're pulling DOWN
            // 3. We're still at top
            if (isActive.current && distance > 10 && window.scrollY === 0 && !isRefreshing) {
                e.preventDefault();
            } else {
                // Not a pull gesture, disable pull-to-refresh for this touch
                if (distance < 0 || window.scrollY > 0) {
                    isActive.current = false;
                    setPullDistance(0);
                }
            }
        };

        const handleTouchEnd = async () => {
            if (!isActive.current) {
                setPullDistance(0);
                startY.current = 0;
                currentY.current = 0;
                return;
            }

            const finalDistance = Math.pow(currentY.current - startY.current, 0.7);

            if (finalDistance >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(threshold);
                await onRefresh();
                setIsRefreshing(false);
                setPullDistance(0);
            } else {
                setPullDistance(0);
            }

            isActive.current = false;
            startY.current = 0;
            currentY.current = 0;
        };

        animationFrame = requestAnimationFrame(updatePull);

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            cancelAnimationFrame(animationFrame);
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, threshold, isRefreshing]);

    const rotation = Math.min((pullDistance / threshold) * 360, 360);
    const progress = Math.min(pullDistance / threshold, 1);

    return {
        pullDistance,
        isRefreshing,
        isPulling: pullDistance > 0,
        isReadyToRefresh: pullDistance >= threshold,
        rotation,
        progress
    };
};
