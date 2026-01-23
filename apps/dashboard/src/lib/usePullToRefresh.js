import { useState, useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh, threshold = 100) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const isActive = useRef(false);  // Only true when we started a valid pull gesture

    useEffect(() => {
        const handleTouchStart = (e) => {
            // Only activate if we're at the very top of the page
            if (window.scrollY === 0) {
                startY.current = e.touches[0].clientY;
                isActive.current = true;
            } else {
                isActive.current = false;
            }
        };

        const handleTouchMove = (e) => {
            // Not in pull mode or refreshing, ignore
            if (!isActive.current || isRefreshing) return;

            const currentY = e.touches[0].clientY;
            const distance = currentY - startY.current;

            // Only process if pulling DOWN and still at top
            if (distance > 10 && window.scrollY === 0) {
                // Prevent default scroll behavior during pull
                e.preventDefault();
                setPullDistance(Math.min(distance, threshold * 1.5));
            } else if (distance <= 0) {
                // User pulled back up - cancel the gesture
                setPullDistance(0);
                isActive.current = false;
            }
        };

        const handleTouchEnd = async () => {
            if (!isActive.current) {
                setPullDistance(0);
                return;
            }

            // Check if pulled enough to trigger refresh
            if (pullDistance >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(0);
                isActive.current = false;
                await onRefresh();
                setIsRefreshing(false);
            } else {
                // Not enough pull - just reset
                setPullDistance(0);
            }

            isActive.current = false;
            startY.current = 0;
        };

        // Use passive: false for touchmove so we can preventDefault
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
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
