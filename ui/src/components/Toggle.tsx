import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faX } from "@fortawesome/free-solid-svg-icons";

interface ToggleProps {
    checked: boolean;
    onChange: () => void;
    label?: string;
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export default function Toggle(props: ToggleProps) {
    return (
        <div className={props.className}>
            <label className={`relative inline-flex items-center ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} z-0`}>
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={props.checked}
                    onChange={props.onChange}
                    disabled={props.disabled}
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
                    bg-neutral-200 dark:bg-neutral-800
                    peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-primary/20
                    peer-checked:bg-accent-primary dark:peer-checked:bg-accent-primary
                    after:content-[''] after:absolute after:top-[4px] after:left-[4px]
                    after:bg-white dark:after:bg-neutral-700
                    after:rounded-full after:h-6 after:w-6 after:transition-all
                    peer-checked:after:translate-x-full peer-checked:after:left-[-5px]
                `} />

                <span className="ml-3 text-md font-medium">
                    {props.label}
                    {props.children}
                </span>
            </label>
        </div>
    );
}
