import React, { useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ThemeContext } from "../contexts/ThemeContext";
import Text from "./Text";
export default function Button(props) {
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
    const variantClasses = {
        default: (props.themed !== true && !hasCustomBg)
            ? "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-100"
            : "",
        danger: "bg-red-600 hover:bg-red-700 text-white"
    };

    const activeVariantClasses = variantClasses[props.variant || "default"];

    const sizeClasses = {
        sm: `${props.padding !== undefined ? "h-auto" : "h-8 px-3 py-1"} text-sm`,
        md: `${props.padding !== undefined ? "h-auto" : "h-12 px-4 py-2"}`,
        lg: `${props.padding !== undefined ? "h-auto" : "h-14 px-6 py-2"} text-lg`,
        xl: `${props.padding !== undefined ? "h-auto" : "h-16 px-8 py-4"} text-xl`,
        '2xl': `${props.padding !== undefined ? "h-auto" : "h-20 px-12 py-6"} text-2xl`,
    };

    const paddingClass = props.padding !== undefined
        ? (typeof props.padding === 'number' ? `p-${props.padding}` : props.padding)
        : "";

    return (
        <button
            className={`${baseClasses} ${sizeClasses[props.size || "md"]} ${themedClasses} ${activeVariantClasses} ${paddingClass} ${props.className || ""}`}
            disabled={props.disabled}
            onClick={props.onClick || (() => { })}
            title={props.title}
        >
            {props.icon && (
                <FontAwesomeIcon
                    className={`${props.children ? "mr-2" : "mr-0"}`}
                    icon={props.icon}
                />
            )}

            {props.children && (
                props.themed || props.variant === "danger" ? props.children :
                    <Text
                        className="font-semibold flex-1 min-w-0 flex items-center justify-center"
                        size={props.size || "md"}
                    >
                        {props.children}
                    </Text>
            )}
        </button>
    );
}
