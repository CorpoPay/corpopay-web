"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";
import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full text-xs font-semibold",
      "bg-primary text-primary-foreground",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/** Convenience component that renders initials from a name/email */
function AvatarInitials({
  name,
  className,
  size = "default",
}: {
  name?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const initials = name
    ? name
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "?";

  const sizes = {
    sm: "h-7 w-7 text-xs",
    default: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  };

  return (
    <Avatar className={cn(sizes[size], className)}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export { AvatarInitials };
