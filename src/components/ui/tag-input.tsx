import { useState } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/utils/utils";

interface TagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  className?: string;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = "输入后按 Enter 添加",
  disabled = false,
  maxTags,
  className
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAddTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    const exists = value.some(tag => tag.toLowerCase() === normalized);
    if (exists) {
      setInputValue("");
      return;
    }
    if (maxTags && value.length >= maxTags) {
      setInputValue("");
      return;
    }
    onChange?.([...value, trimmed]);
    setInputValue("");
  };

  const handleRemoveTag = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    } else if (event.key === 'Backspace' && !inputValue && value.length) {
      event.preventDefault();
      handleRemoveTag(value.length - 1);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary/40",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              className="ml-2 rounded-full text-primary/70 hover:text-primary"
              onClick={() => handleRemoveTag(index)}
              disabled={disabled}
              aria-label={`移除标签 ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || (maxTags ? value.length >= maxTags : false)}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[120px] border-0 bg-transparent text-sm focus-visible:outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

export default TagInput;
