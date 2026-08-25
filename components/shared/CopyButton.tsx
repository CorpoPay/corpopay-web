"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "icon" | "sm" | "default";
}

export function CopyButton({
  value,
  label,
  successMessage = "Copied to clipboard",
  className,
  variant = "ghost",
  size = "icon",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  const Icon = copied ? Check : Copy;
  const buttonEl = (
    <Button
      variant={variant}
      size={size}
      className={cn(
        size === "icon" && "h-8 w-8",
        copied && "text-primary",
        "transition-colors duration-200",
        className,
      )}
      onClick={handleCopy}
      aria-label={label ?? "Copy to clipboard"}
      type="button"
    >
      <Icon className={cn("h-4 w-4 transition-transform duration-150", copied && "scale-110")} />
      {label && size !== "icon" && <span className="ml-2">{copied ? "Copied!" : label}</span>}
    </Button>
  );

  if (size === "icon") {
    return <Tooltip content={copied ? "Copied!" : "Copy"}>{buttonEl}</Tooltip>;
  }
  return buttonEl;
}
