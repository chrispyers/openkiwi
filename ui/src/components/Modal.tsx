import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerActions?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
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

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={`bg-bg-card w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border-color flex flex-col overflow-hidden animate-in zoom-in duration-200 shadow-2xl ${className}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-border-color flex justify-between items-center bg-bg-sidebar/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        {title && <h2 className="text-xl font-semibold flex items-center gap-2">{title}</h2>}
                    </div>
                    <div className="flex gap-2">
                        {headerActions}
                        <button
                            className="h-10 w-10 rounded-lg hover:bg-white/10 hover:text-white flex items-center justify-center transition-all duration-200"
                            onClick={onClose}
                            title="Close"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
