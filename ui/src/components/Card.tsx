import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: string;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    title?: string;
}

const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'p-8',
    onClick,
    title
}) => {
    return (
        <div
            onClick={onClick}
            className={`bg-bg-card border border-border-color rounded-3xl ${padding} ${className} ${onClick ? 'cursor-pointer' : ''}`}
            title={title}
        >
            {children}
        </div>
    );
};

export default Card;
