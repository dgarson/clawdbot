/* eslint-disable react-refresh/only-export-components */
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TwoFactorInputProps {
  /** Callback when all 6 digits are entered */
  onComplete: (code: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Auto-focus first input */
  autoFocus?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * 6-digit code input with auto-advance between fields.
 * Supports paste, backspace navigation, and auto-submit.
 */
export function TwoFactorInput({
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  className,
}: TwoFactorInputProps) {
  const [digits, setDigits] = React.useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  React.useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Check for completion
  React.useEffect(() => {
    const code = digits.join("");
    if (code.length === 6 && digits.every((d) => d !== "")) {
      onComplete(code);
    }
  }, [digits, onComplete]);

  const handleChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Auto-advance to next field
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Move to previous field if current is empty
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
      } else {
        // Clear current field
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (pasted.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setDigits(newDigits);

      // Focus appropriate field
      const lastFilledIndex = Math.min(pasted.length - 1, 5);
      inputRefs.current[lastFilledIndex]?.focus();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className={cn("flex justify-center gap-2", className)}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          className={cn(
            "h-12 w-10 rounded-md border bg-background text-center text-lg font-semibold",
            "transition-all outline-none",
            "focus:border-ring focus:ring-ring/50 focus:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
            error
              ? "border-destructive ring-destructive/20"
              : "border-input"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Clear the input (for reset after error).
 */
export function useTwoFactorInputReset() {
  const [key, setKey] = React.useState(0);
  const reset = React.useCallback(() => setKey((k) => k + 1), []);
  return { key, reset };
}

export default TwoFactorInput;
