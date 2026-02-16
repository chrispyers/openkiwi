import React, { useContext } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface SelectProps {
  id?: string;
  className?: string;
  icon?: IconDefinition;
  label?: string;
  options: string[] | { value: string; label: string }[];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  width?: string;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  id,
  className,
  icon,
  label,
  options,
  value,
  onChange,
  width,
  disabled
}) => {
  const context = useContext(ThemeContext);
  const getThemeInputClasses = context?.getThemeInputClasses || (() => "");

  return (
    <div className={`${width != null ? width : "w-full"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {label && <label htmlFor={id} className="block mb-2 text-xs font-bold uppercase tracking-wider">{label}</label>}
      <div className="relative flex items-center">
        {icon && <FontAwesomeIcon className="absolute ml-4 text-neutral-600 dark:text-neutral-400" icon={icon} />}
        <select
          id={id}
          disabled={disabled}
          className={`appearance-none border-2 p-2 pr-10 rounded-2xl transition-all outline-none w-full
            border-neutral-100 dark:border-neutral-700
            bg-neutral-50 dark:bg-neutral-800
            hover:border-neutral-200 dark:hover:border-neutral-600
            ${icon != null ? "pl-11" : "pl-4"}
            ${getThemeInputClasses()} ${className || ""}
          `}
          value={value}
          onChange={onChange}
        >
          {options.map(option => {
            const optValue = typeof option === 'string' ? option : option.value;
            const optLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
        <FontAwesomeIcon className="absolute right-4 text-neutral-400 dark:text-neutral-400 pointer-events-none" icon={faChevronDown} />
      </div>
    </div>
  );
};

export default Select;
