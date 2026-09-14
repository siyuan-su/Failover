import { useEffect, useRef, useState } from "react";
import "./CustomSelect.css";

type CustomSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

export default function CustomSelect({
  value,
  options,
  onChange,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  return (
    <div
      className="custom-select"
      ref={containerRef}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() =>
          setOpen((current) => !current)
        }
      >
        <span>{value}</span>

        <span
          className={`custom-select-arrow ${
            open ? "open" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="custom-select-menu">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`custom-select-option ${
                option === value
                  ? "selected"
                  : ""
              }`}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}