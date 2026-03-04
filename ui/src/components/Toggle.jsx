import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faX } from "@fortawesome/free-solid-svg-icons";
import { Tooltip } from "./Tooltip";

export default function Toggle({
    checked,
    onChange,
    label,
    disabled = false,
    title,
    className = '',
    children
}) {
    const toggleContent = (
        <div className={`relative inline-block ${className}`}>
            <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} z-0`}>
                <div className={`flex items-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={checked}
                        onChange={onChange}
                        disabled={disabled}
                    />

                    {/* check icon */}
                    <FontAwesomeIcon
                        className="text-center text-neutral-700 dark:text-white z-10 absolute w-8 left-[-1px] transition-all peer-checked:w-16 opacity-0 peer-checked:opacity-100 text-[10px]"
                        icon={faCheck}
                    />

                    {/* x icon */}
                    <FontAwesomeIcon
                        className="text-center text-neutral-700 dark:text-white z-10 absolute w-8 left-[0px] transition-all peer-checked:w-16 opacity-100 peer-checked:opacity-0 text-[10px]"
                        icon={faX}
                    />

                    {/* size and shape (The track) */}
                    <div className={`w-12 h-8 rounded-full peer transition-all
                        bg-[var(--toggle-off-bg)]
                        peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-primary/20
                        peer-checked:bg-[var(--toggle-on-bg)]
                        after:content-[''] after:absolute after:top-[4px] after:left-[4px]
                        after:bg-white dark:after:bg-neutral-700
                        after:rounded-full after:h-6 after:w-6 after:transition-all
                        peer-checked:after:translate-x-full peer-checked:after:left-[-5px]
                    `} />

                    <span className="ml-3 text-md font-medium">
                        {label}
                        {children}
                    </span>
                </div>
            </label>

            {/* Overlay to handle cursor when disabled */}
            {disabled && (
                <div className="absolute inset-0 z-10 cursor-not-allowed" />
            )}
        </div>
    );

    if (title) {
        return (
            <Tooltip content={title} className="inline-block">
                {toggleContent}
            </Tooltip>
        );
    }

    return toggleContent;
}

Toggle.displayName = 'Toggle';
