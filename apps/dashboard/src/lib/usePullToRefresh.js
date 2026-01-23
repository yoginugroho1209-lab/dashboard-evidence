import { useState, useEffect, useCallback } from 'react';

export const usePullToRefresh = (onRefresh, threshold = 80) => {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    let startY = 0;

    const handleTouchStart = useCallback((e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (window.scrollY === 0 && startY > 0) {
            const currentY = e.touches[0].clientY;
            const distance = currentY - startY;

            if (distance > 0) {
                setIsPulling(true);
                setPullDistance(Math.min(distance, threshold * 1.5));

                if (distance > threshold / 2) {
                    e.preventDefault();
                }
            }
        }
    }, [threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            await onRefresh();
            setIsRefreshing(false);
        }
        setIsPulling(false);
        setPullDistance(0);
        startY = 0;
    }, [pullDistance, threshold, isRefreshing, onRefresh]);

    useEffect(() => {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return { isPulling, pullDistance, isRefreshing };
};
