import { Search } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  containerClassName?: string;
  onChange?: (value: string) => void;
}

export function SearchInput({
  className,
  containerClassName,
  onChange,
  ...props
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative flex-1 min-w-0", containerClassName)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        aria-hidden
      />
      <Input
        ref={inputRef}
        className={cn("pl-9", className)}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...props}
      />
    </div>
  );
}
