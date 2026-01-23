import { useState, useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh, threshold = 120) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isActive = useRef(false);

    useEffect(() => {
        let animationFrame;

        const updatePull = () => {
            if (isActive.current && !isRefreshing) {
                const distance = currentY.current - startY.current;
                if (distance > 0) {
                    // Use easing for smoother pull feel (like rubber band)
                    const easedDistance = Math.pow(distance, 0.7);
                    setPullDistance(easedDistance);
                } else {
                    setPullDistance(0);
                }
            }
            animationFrame = requestAnimationFrame(updatePull);
        };

        const handleTouchStart = (e) => {
            if (window.scrollY === 0 && !isRefreshing) {
                startY.current = e.touches[0].clientY;
                currentY.current = e.touches[0].clientY;
                isActive.current = true;
            }
        };

        const handleTouchMove = (e) => {
            if (!isActive.current || isRefreshing) return;

            currentY.current = e.touches[0].clientY;
            const distance = currentY.current - startY.current;

            // Prevent scroll when pulling down at top
            if (distance > 5 && window.scrollY === 0) {
                e.preventDefault();
            }
        };

        const handleTouchEnd = async () => {
            if (!isActive.current) return;

            const finalDistance = Math.pow(currentY.current - startY.current, 0.7);

            if (finalDistance >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(threshold); // Keep at threshold during refresh
                await onRefresh();
                setIsRefreshing(false);
                setPullDistance(0);
            } else {
                // Animate back to 0 smoothly
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

    // Calculate rotation based on pull distance (0 to 360 degrees)
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
