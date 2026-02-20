import React, { useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ThemeContext } from "../contexts/ThemeContext";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import Text from "./Text";

interface ButtonProps {
    className?: string;
    themed?: boolean;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    icon?: IconDefinition;
    children?: React.ReactNode;
    title?: string;
    size?: "sm" | "md" | "lg";
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

    const baseClasses = "rounded-xl transition-all font-semibold disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center";

    const themedClasses = props.themed === true ? getThemeButtonClasses() : "";

    const defaultClasses = (props.themed !== true && !hasCustomBg)
        ? "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600"
        : "";

    const sizeClasses = {
        sm: "px-3 py-1",
        md: "px-4 py-2",
        lg: "px-6 py-2"
    };

    return (
        <button
            className={`${baseClasses} ${sizeClasses[props.size || "md"]} ${themedClasses} ${defaultClasses} ${props.className || ""}`}
            disabled={props.disabled}
            onClick={props.onClick || (() => { })}
            title={props.title}
        >
            {props.icon &&
                props.themed ?
                <FontAwesomeIcon className={props.children ? "mr-2 " : "mr-0"} icon={props.icon} />
                :
                <Text className={props.children ? "h-auto" : "h-full"}><FontAwesomeIcon className={props.children ? "mr-2 " : "mr-0"} icon={props.icon} /></Text>
            }

            {props.themed ? props.children :
                <Text className={`font-semibold`} size={props.size || "md"}>
                    {props.children}
                </Text>
            }
        </button>
    );
}
