import React, { useContext, forwardRef } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import Text from "./Text";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    id?: string;
    label?: React.ReactNode;
    currentText?: string;
    textAreaClassName?: string;
    containerClassName?: string;
    width?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
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
    ...rest
}, ref) => {
    const context = useContext(ThemeContext);
    const getThemeInputClasses = context?.getThemeInputClasses || (() => "");

    const defaultTextAreaClasses = "border-2 p-4 rounded-2xl bg-white dark:bg-bg-primary border-neutral-100 dark:border-neutral-700 hover:border-neutral-200 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100";

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
                    className={`${!className && !textAreaClassName ? defaultTextAreaClasses : ""}
                        transition-colors w-full resize-none
                        placeholder-neutral-300 dark:placeholder-neutral-500
                        ${getThemeInputClasses()}
                        ${className || ""} ${textAreaClassName || ""}`}
                    value={value !== undefined ? value : currentText}
                    onChange={onChange || (() => { })}
                    placeholder={placeholder}
                ></textarea>
            </div>
        </div>
    );
});

TextArea.displayName = 'TextArea';

export default TextArea;
