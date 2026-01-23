import { useState, useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh, threshold = 60) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isActive = useRef(false);
    const wasAtTop = useRef(false);

    useEffect(() => {
        let animationFrame;

        const updatePull = () => {
            if (isActive.current && wasAtTop.current && !isRefreshing) {
                const distance = currentY.current - startY.current;
                if (distance > 0) {
                    const easedDistance = Math.pow(distance, 0.8);
                    setPullDistance(easedDistance);
                } else {
                    setPullDistance(0);
                }
            }
            animationFrame = requestAnimationFrame(updatePull);
        };

        const handleTouchStart = (e) => {
            startY.current = e.touches[0].clientY;
            currentY.current = e.touches[0].clientY;
            // Record if we started at the very top
            wasAtTop.current = window.scrollY <= 0;
            isActive.current = true;
        };

        const handleTouchMove = (e) => {
            currentY.current = e.touches[0].clientY;
            const distance = currentY.current - startY.current;

            // ONLY prevent default if ALL conditions are met:
            // 1. We started at top (wasAtTop is true)
            // 2. We're still at top (scrollY is 0)
            // 3. We're pulling DOWN (distance > 0)
            // 4. Not currently refreshing
            if (wasAtTop.current && window.scrollY <= 0 && distance > 10 && !isRefreshing) {
                e.preventDefault();
            } else if (distance < 0 || window.scrollY > 0) {
                // User is scrolling normally or page has scrolled, disable pull-to-refresh
                isActive.current = false;
                wasAtTop.current = false;
                setPullDistance(0);
            }
        };

        const handleTouchEnd = async () => {
            if (!isActive.current || !wasAtTop.current) {
                setPullDistance(0);
                startY.current = 0;
                currentY.current = 0;
                isActive.current = false;
                wasAtTop.current = false;
                return;
            }

            const finalDistance = Math.pow(currentY.current - startY.current, 0.8);

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
            wasAtTop.current = false;
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
