import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Text from './Text';
import Button from './Button';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    className = '',
    headerActions
}) => {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-100"
            onClick={onClose}
        >
            <div
                className={`w-full max-w-4xl max-h-[90vh] bg-modal rounded-3xl flex flex-col overflow-hidden animate-in zoom-in duration-100 shadow-2xl ${className}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-divider flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {title && <div className="flex items-center gap-2"><Text size="xl" className="font-semibold">{title}</Text></div>}
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        {headerActions}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={onClose} icon={faXmark} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
