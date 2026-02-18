import React, { useContext, forwardRef } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface InputProps {
  id?: string;
  label?: React.ReactNode;
  currentText: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: IconDefinition;
  clearText?: () => void;
  className?: string;
  inputClassName?: string;
  children?: React.ReactNode;
  width?: string;
  readOnly?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  label,
  currentText,
  placeholder,
  onChange,
  icon,
  clearText,
  className,
  inputClassName,
  children,
  width,
  readOnly
}, ref) => {
  const context = useContext(ThemeContext);
  const getThemeInputClasses = context?.getThemeInputClasses || (() => "");

  return (
    <div className={`${width != null ? width : "w-full"} ${className || ""}`}>
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          {label}
        </label>
      )}
      <div className={`relative ${label ? '' : 'mt-1'}`}>
        {icon && (
          <FontAwesomeIcon
            className="absolute mt-3.5 ml-4 text-neutral-600 dark:text-neutral-400"
            icon={icon}
          />
        )}

        <input
          id={id}
          type="text"
          ref={ref}
          readOnly={readOnly}
          className={`border-2 py-2 pl-10 pr-10 rounded-2xl transition-all outline-none w-full
            placeholder-neutral-300 dark:placeholder-neutral-500
            dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700
            hover:border-neutral-200 dark:hover:border-neutral-600
            ${getThemeInputClasses()} ${inputClassName || ""}`}
          value={currentText}
          placeholder={placeholder}
          onChange={onChange || (() => { })}
        />

        {/* a little"X"button to clear the text */}
        {currentText && clearText && (
          <button
            onClick={clearText}
            className="text-lg absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-500 hover:text-neutral-400 dark:hover:text-neutral-400 focus:outline-none transition-all"
          >
            <FontAwesomeIcon icon={faTimesCircle} />
          </button>
        )}

        {children}
      </div>
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
