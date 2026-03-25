import React, { useContext, forwardRef } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import Text from "./Text";
const Input = forwardRef(({
  id,
  label,
  currentText,
  placeholder,
  onChange,
  onFocus,
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
          className="block uppercase mb-1 tracking-wider flex items-center gap-2"
        >
          <Text size="xs" bold={true}>{label}</Text>
        </label>
      )}
      <div className="relative">
        {icon && (
          <FontAwesomeIcon
            className="absolute top-1/2 -translate-y-1/2 ml-4 text-secondary"
            icon={icon}
          />
        )}

        <input
          id={id}
          type="text"
          ref={ref}
          readOnly={readOnly}
          style={{ backgroundColor: 'var(--input-bg)' }}
          className={`border-2 py-2.5 rounded-2xl transition-colors w-full
            placeholder-neutral-300 dark:placeholder-neutral-500
            border-neutral-100 dark:border-neutral-700
            hover:border-neutral-200 dark:hover:border-neutral-600
            text-primary
            ${icon != null ? "pl-12" : "pl-4"} pr-10
            ${getThemeInputClasses()} ${inputClassName || ""}`}
          value={currentText}
          placeholder={placeholder}
          onChange={onChange || (() => { })}
          onFocus={onFocus}
        />

        {/* a little"X"button to clear the text */}
        {currentText && clearText && (
          <button
            onClick={clearText}
            className="text-lg absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:opacity-80 focus:outline-none transition-all"
          >
            <FontAwesomeIcon icon={faTimesCircle} />
          </button>
        )}

        {children}
      </div>
    </div >
  );
});

Input.displayName = 'Input';

export default Input;
