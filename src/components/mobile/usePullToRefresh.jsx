import { useState, useEffect, useRef } from "react";

export function usePullToRefresh(onRefresh, options = {}) {
    const {
        threshold = 80,
        maxPullDistance = 150,
        resistance = 2.5,
        enabled = true
    } = options;

    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    
    const startYRef = useRef(0);
    const isTouchingRef = useRef(false);
    const rafIdRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        const handleTouchStart = (e) => {
            // Only start if at top of page
            const isAtTop = window.scrollY === 0 || document.documentElement.scrollTop === 0;
            
            if (isAtTop && !refreshing) {
                startYRef.current = e.touches[0].clientY;
                isTouchingRef.current = true;
            }
        };

        const handleTouchMove = (e) => {
            if (!isTouchingRef.current || startYRef.current === 0) return;
            
            const currentY = e.touches[0].clientY;
            const rawPull = currentY - startYRef.current;

            // Check if at top - check both window and body scroll
            const isAtTop = window.scrollY === 0 && 
                           document.documentElement.scrollTop === 0 && 
                           document.body.scrollTop === 0;
            
            // Process downward pulls at top of page
            if (rawPull > 0 && isAtTop) {
                // ALWAYS prevent default on iOS when pulling down from top
                e.preventDefault();
                e.stopPropagation();
                
                // Apply resistance to make pull feel more natural
                const resistedPull = Math.min(rawPull / resistance, maxPullDistance);

                if (resistedPull > 5) {
                    setIsPulling(true);
                }

                // Use RAF for smooth animation
                if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = requestAnimationFrame(() => {
                    setPullDistance(resistedPull);
                });
            }
        };

        const handleTouchEnd = async () => {
            if (!isTouchingRef.current) return;

            isTouchingRef.current = false;
            setIsPulling(false);

            if (pullDistance > threshold && !refreshing) {
                setRefreshing(true);
                try {
                    await onRefresh();
                } catch (error) {
                    console.error('Refresh error:', error);
                } finally {
                    setTimeout(() => {
                        setRefreshing(false);
                        setPullDistance(0);
                    }, 500);
                }
            } else {
                setPullDistance(0);
            }
            
            // Reset state
            startYRef.current = 0;
        };

        // Use passive: false for touchmove to allow preventDefault on iOS
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchEnd);
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [pullDistance, onRefresh, threshold, maxPullDistance, resistance, enabled, refreshing]);

    return { refreshing, pullDistance, isPulling };
}

export function PullToRefreshIndicator({ pullDistance, refreshing, isPulling, threshold = 80 }) {
    if (pullDistance === 0 && !refreshing && !isPulling) return null;

    const progress = Math.min(pullDistance / threshold, 1);
    const shouldShowText = pullDistance > threshold * 0.5;

    return (
        <div 
            className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
            style={{ 
                transform: `translateY(${refreshing ? '16px' : `${Math.min(pullDistance * 0.8, 64)}px`})`,
                transition: refreshing ? 'transform 0.3s ease-out' : 'none'
            }}
        >
            <div 
                className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2"
                style={{
                    opacity: refreshing ? 1 : progress,
                    transform: `scale(${0.8 + (progress * 0.2)})`,
                    transition: refreshing ? 'opacity 0.2s, transform 0.2s' : 'none'
                }}
            >
                <div className={`${refreshing ? 'animate-spin' : ''}`} style={{
                    transform: !refreshing ? `rotate(${progress * 360}deg)` : 'none',
                    transition: refreshing ? 'none' : 'transform 0.1s'
                }}>
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>
                {shouldShowText && (
                    <span className="text-sm font-medium text-slate-700">
                        {refreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull down'}
                    </span>
                )}
            </div>
        </div>
    );
}