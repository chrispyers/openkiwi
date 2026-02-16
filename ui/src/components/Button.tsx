import React, { useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ThemeContext } from "../contexts/ThemeContext";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface ButtonProps {
    className?: string;
    themed?: boolean;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    icon?: IconDefinition;
    children?: React.ReactNode;
    title?: string;
}

export default function Button(props: ButtonProps) {
    const context = useContext(ThemeContext);

    // Safety check in case ThemeProvider is missing
    const getThemeButtonClasses = context?.getThemeButtonClasses || (() => "");

    // Check if props.className already contains a background color class
    const hasCustomBg = props.className && (
        props.className.includes('bg-') ||
        props.className.includes('dark:bg-')
    );

    const baseClasses = "px-4 py-3 rounded-xl transition-all font-semibold disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center";

    const themedClasses = props.themed === true ? getThemeButtonClasses() : "";

    const defaultClasses = (props.themed !== true && !hasCustomBg)
        ? "text-neutral-500 bg-neutral-100 hover:bg-neutral-200 dark:text-neutral-100 dark:bg-neutral-700 dark:hover:bg-neutral-600"
        : "";

    return (
        <button
            className={`${baseClasses} ${themedClasses} ${defaultClasses} ${props.className || ""}`}
            disabled={props.disabled}
            onClick={props.onClick || (() => { })}
            title={props.title}
        >
            {props.icon && <FontAwesomeIcon className={props.children ? "mr-2 " : "mr-0"} icon={props.icon} />}
            {props.children}
        </button>
    );
}
