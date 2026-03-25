import React, { useContext } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import Text from "./Text";
const Select = ({
  id,
  className,
  icon,
  label,
  options,
  optionGroups,
  value,
  onChange,
  width,
  disabled
}) => {
  const context = useContext(ThemeContext);
  const getThemeInputClasses = context?.getThemeInputClasses || (() => "");

  return (
    <div className={`${width != null ? width : "w-full"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {label && <label htmlFor={id} className="block mb-1 uppercase tracking-wider">
        <Text size="xs" bold={true}>{label}</Text>
      </label>
      }
      <div className="relative flex items-center w-full">
        {icon && <Text className="absolute ml-4"><FontAwesomeIcon icon={icon} /></Text>}
        <Text className="w-full">

          <select
            id={id}
            disabled={disabled}
            style={{ backgroundColor: 'var(--select-bg)' }}
            className={`appearance-none border-2 p-2 pr-10 rounded-2xl transition-colors outline-none w-full
            border-neutral-100 dark:border-neutral-700
            hover:border-neutral-200 dark:hover:border-neutral-600
            text-primary
            ${icon != null ? "pl-11" : "pl-4"}
            ${getThemeInputClasses()} ${className || ""}
          `}
            value={value}
            onChange={onChange}
          >
            {options && options.map(option => {
              const optValue = typeof option === 'string' ? option : option.value;
              const optLabel = typeof option === 'string' ? option : option.label;
              return (
                <option key={optValue} value={optValue}>
                  {optLabel}
                </option>
              );
            })}
            {optionGroups && optionGroups.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(option => {
                  const optValue = typeof option === 'string' ? option : option.value;
                  const optLabel = typeof option === 'string' ? option : option.label;
                  return (
                    <option key={optValue} value={optValue}>
                      {optLabel}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>

        </Text>
        <Text className="absolute right-4"><FontAwesomeIcon className="pointer-events-none" icon={faChevronDown} /></Text>
      </div>
    </div>
  );
};

export default Select;
