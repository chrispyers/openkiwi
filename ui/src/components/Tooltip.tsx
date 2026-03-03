import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    title?: string;
    className?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip = ({ content, children, title, className = '', position = 'top' }: TooltipProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();

        let top = 0;
        let left = 0;

        switch (position) {
            case 'top':
                top = rect.top - 8;
                left = rect.left + rect.width / 2;
                break;
            case 'bottom':
                top = rect.bottom + 8;
                left = rect.left + rect.width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2;
                left = rect.left - 8;
                break;
            case 'right':
                top = rect.top + rect.height / 2;
                left = rect.right + 8;
                break;
        }

        setCoords({ top, left });
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        updatePosition();
        setIsVisible(true);
        // Small delay to allow portal to mount before starting transition
        setTimeout(() => setIsAnimating(true), 10);
    };

    const handleMouseLeave = () => {
        setIsAnimating(false);
        timeoutRef.current = window.setTimeout(() => {
            setIsVisible(false);
        }, 200);
    };

    const getBaseTransform = () => {
        switch (position) {
            case 'top': return 'translate(-50%, -100%)';
            case 'bottom': return 'translate(-50%, 0)';
            case 'left': return 'translate(-100%, -50%)';
            case 'right': return 'translate(0, -50%)';
            default: return 'none';
        }
    };

    const getOffsetTransform = () => {
        if (!isAnimating) {
            switch (position) {
                case 'top': return 'translateY(-4px)';
                case 'bottom': return 'translateY(4px)';
                case 'left': return 'translateX(-4px)';
                case 'right': return 'translateX(4px)';
                default: return 'none';
            }
        }
        return 'translate(0, 0)';
    };

    useEffect(() => {
        if (isVisible) {
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isVisible]);

    if (!content) return <>{children}</>;

    return (
        <div
            ref={triggerRef}
            className={`inline-block ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {isVisible && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        transform: `${getBaseTransform()} ${getOffsetTransform()}`,
                        opacity: isAnimating ? 1 : 0,
                        zIndex: 9999,
                        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
                    }}
                    className={`${title ? 'px-4 py-2' : 'px-3 py-1.5'} bg-neutral-900 border border-white/10 text-white text-xs rounded-xl shadow-2xl max-w-xs break-words pointer-events-none`}
                >
                    {title && (
                        <div className="font-semibold mb-1 opacity-50 uppercase text-[10px] tracking-wider border-b border-white/5 pb-1">
                            {title}
                        </div>
                    )}
                    {content}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Tooltip;
