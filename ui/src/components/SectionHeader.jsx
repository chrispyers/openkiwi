import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Text from './Text';

export default function SectionHeader({ icon, title, className = '', columns, iconClasses = '' }) {
    const spanMap = {
        1: 'col-span-1',
        2: 'col-span-2',
        3: 'col-span-3',
        4: 'col-span-4',
        5: 'col-span-5',
        6: 'col-span-6',
        7: 'col-span-7',
        8: 'col-span-8',
        9: 'col-span-9',
        10: 'col-span-10',
        11: 'col-span-11',
        12: 'col-span-12',
        full: 'col-span-full'
    };

    const colSpanClass = spanMap[columns] || '';

    return (
        <div className={`flex items-center ${icon ? 'gap-2' : ''} ${colSpanClass} ${className} w-full`}>
            {icon && (
                iconClasses ? (
                    <Text className={`flex items-center justify-center shrink-0 ${iconClasses}`}>
                        <FontAwesomeIcon icon={icon} />
                    </Text>
                ) : (
                    <Text className="flex items-center justify-center">
                        <FontAwesomeIcon icon={icon} />
                    </Text>
                )
            )}
            <Text bold={true} size="xl">
                {title}
            </Text>
        </div>
    );
}

SectionHeader.displayName = 'SectionHeader';
