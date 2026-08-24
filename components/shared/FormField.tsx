import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  hint?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  children,
  className,
  required,
  hint,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden>
              *
            </span>
          )}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
