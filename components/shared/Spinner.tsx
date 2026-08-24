import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "default" | "lg";
}

const sizes = {
  sm: "h-4 w-4 border-2",
  default: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
};

export function Spinner({ className, size = "default" }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary border-t-transparent",
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
