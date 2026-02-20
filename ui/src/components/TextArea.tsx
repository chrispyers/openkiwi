import React, { useContext, forwardRef } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import Text from "./Text";

interface TextAreaProps {
    id?: string;
    label?: React.ReactNode;
    currentText: string;
    placeholder?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    textAreaClassName?: string;
    width?: string;
    rows?: number;
    readOnly?: boolean;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
    id,
    label,
    currentText,
    placeholder,
    onChange,
    className,
    textAreaClassName,
    width,
    rows = 4,
    readOnly
}, ref) => {
    const context = useContext(ThemeContext);
    const getThemeInputClasses = context?.getThemeInputClasses || (() => "");

    return (
        <div className={`${width != null ? width : "w-full"} ${className || ""}`}>
            {label && (
                <label
                    htmlFor={id}
                    className="block uppercase mb-1 tracking-wider flex items-center gap-2"
                >
                    <Text size="xs" bold={true}>{label}</Text>
                </label>
            )}
            <div className="relative">
                <Text>
                    <textarea
                        id={id}
                        ref={ref}
                        rows={rows}
                        readOnly={readOnly}
                        className={`border-2 p-4 rounded-2xl transition-all outline-none w-full
                            dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700
                            placeholder-neutral-300 dark:placeholder-neutral-500
                            hover:border-neutral-200 dark:hover:border-neutral-600
                            ${getThemeInputClasses()} ${textAreaClassName || ""}`}
                        value={currentText}
                        onChange={onChange || (() => { })}
                        placeholder={placeholder}
                    ></textarea>
                </Text>
            </div>
        </div>
    );
});

TextArea.displayName = 'TextArea';

export default TextArea;
