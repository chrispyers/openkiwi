import React from 'react';
import Button from './Button';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

interface DeleteButtonProps {
    onClick: (e: React.MouseEvent) => void;
    className?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({ onClick, className = '' }) => {
    return (
        <Button
            className={`opacity-0 group-hover:opacity-100 !p-1.5 !rounded-lg flex-shrink-0 text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 dark:text-neutral-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 ${className}`}
            icon={faTrash}
            onClick={onClick}
        />
    );
};

export default DeleteButton;
