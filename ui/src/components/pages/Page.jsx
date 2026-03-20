import Text from '../Text'
import Column from "../Column"

export default function Page({
    title,
    subtitle,
    headerAction,
    children,
    gridCols,
    gap = 'gap-3',
    align = 'start',
    padding = 'p-6 lg:p-8',
    scroll = true
}) {
    // Convert numeric gap/padding to string format if necessary
    const gapClass = typeof gap === 'number' ? `gap-${gap}` : gap;
    const paddingClass = typeof padding === 'number' ? `p-${padding}` : padding;

    const gridMap = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
        6: 'grid-cols-6',
        7: 'grid-cols-7',
        8: 'grid-cols-8',
        9: 'grid-cols-9',
        10: 'grid-cols-10',
        11: 'grid-cols-11',
        12: 'grid-cols-12'
    };

    const containerClasses = gridCols
        ? `grid ${gridMap[gridCols] || `grid-cols-${gridCols}`} ${gapClass} ${align === 'center' ? 'justify-items-center' : ''}`
        : `flex flex-col ${gapClass} ${align === 'center' ? 'items-center' : ''}`;

    return (
        <div className={`flex-1 ${paddingClass} ${scroll ? 'overflow-y-auto' : 'overflow-hidden flex flex-col'} h-full box-border m-0`}>
            {title && (
                <header className="mb-10 animate-in fade-in duration-300 flex items-center justify-between">
                    <div>
                        <Text size="3xl" bold={true}>{title}</Text>
                        {subtitle && (
                            <Column><Text secondary={true}>{subtitle}</Text></Column>
                        )}
                    </div>
                    {headerAction && (
                        <div className="ml-4 shrink-0 flex items-center">
                            {headerAction}
                        </div>
                    )}
                </header>
            )}
            <div
                className={`w-full animate-in fade-in duration-300 ${containerClasses} ${!scroll ? 'flex-1 min-h-0' : ''}`}
                style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
            >
                {children}
            </div>
        </div>
    );
}
