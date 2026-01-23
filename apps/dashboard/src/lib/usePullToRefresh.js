import { useState, useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh, threshold = 100) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const isPullingRef = useRef(false);

    useEffect(() => {
        const handleTouchStart = (e) => {
            // Only start if at top of page
            if (window.scrollY === 0) {
                startY.current = e.touches[0].clientY;
                isPullingRef.current = true;
            }
        };

        const handleTouchMove = (e) => {
            if (!isPullingRef.current || isRefreshing) return;

            const currentY = e.touches[0].clientY;
            const distance = currentY - startY.current;

            // Only track downward pulls when at top
            if (distance > 0 && window.scrollY === 0) {
                setPullDistance(distance);
            } else {
                setPullDistance(0);
            }
        };

        const handleTouchEnd = async () => {
            if (!isPullingRef.current) return;

            const currentPull = pullDistance;

            // Check if pulled enough to trigger refresh
            if (currentPull >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(0);
                await onRefresh();
                setIsRefreshing(false);
            } else {
                // Cancel - reset
                setPullDistance(0);
            }

            isPullingRef.current = false;
            startY.current = 0;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, threshold, pullDistance, isRefreshing]);

    return {
        pullDistance,
        isRefreshing,
        isPulling: pullDistance > 0,
        isReadyToRefresh: pullDistance >= threshold
    };
};
