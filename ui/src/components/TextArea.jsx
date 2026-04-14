import React, { useContext, forwardRef } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import Text from "./Text";

const TextArea = forwardRef(({
    id,
    label,
    currentText,
    placeholder,
    onChange,
    className,
    textAreaClassName,
    containerClassName,
    width,
    rows = 4,
    readOnly,
    disabled,
    value,
    code = false,
    action,
    ...rest
}, ref) => {
    const context = useContext(ThemeContext);
    const getThemeInputClasses = context?.getThemeInputClasses || (() => "");

    const defaultTextAreaClasses = "border-2 p-4 rounded-2xl border-neutral-100 dark:border-neutral-700 hover:border-neutral-200 dark:hover:border-neutral-600 text-primary";

    return (
        <div className={`${width != null ? width : "w-full"} ${containerClassName || ""}`}>
            {label && (
                <label
                    htmlFor={id}
                    className="block uppercase mb-1 tracking-wider flex items-center gap-2"
                >
                    <Text size="xs" bold={true}>{label}</Text>
                </label>
            )}
            <div className="relative">
                <textarea
                    {...rest}
                    id={id}
                    ref={ref}
                    rows={rows}
                    readOnly={readOnly}
                    disabled={disabled}
                    style={{ backgroundColor: 'var(--textarea-bg)' }}
                    className={`${defaultTextAreaClasses}
                        transition-colors w-full resize-none
                        placeholder-neutral-300 dark:placeholder-neutral-500
                        ${getThemeInputClasses()}
                        ${code ? 'font-mono' : ''}
                        ${action ? 'pr-9' : ''}
                        ${className || ""} ${textAreaClassName || ""}`}
                    value={value !== undefined ? value : currentText}
                    onChange={onChange || (() => { })}
                    placeholder={placeholder}
                ></textarea>
                {action && (
                    <div className="absolute top-2 right-2">
                        {action}
                    </div>
                )}
            </div>
        </div>
    );
});

TextArea.displayName = 'TextArea';

export default TextArea;
