import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Text from './Text';

/**
 * A composite component that renders text alongside a FontAwesome icon.
 * Both the icon and text inherit styles from the Text component.
 * 
 * @param {import('@fortawesome/fontawesome-svg-core').IconDefinition} icon - The FontAwesome icon to display.
 * @param {React.ReactNode} children - The text content to display.
 * @param {string} className - Additional CSS classes.
 * @param {boolean} bold - Whether the text should be bold.
 * @param {string} size - The size of the text/icon ('xs', 'sm', 'md', 'lg', etc).
 */
const TextWithIcon = ({ icon, children, className = '', ...props }) => {
    return (
        <Text className={`flex items-center gap-2 ${className}`} {...props}>
            <FontAwesomeIcon icon={icon} className="shrink-0" />
            <span className="flex-1 min-w-0">{children}</span>
        </Text>
    );
};

TextWithIcon.displayName = 'TextWithIcon';

export default TextWithIcon;
