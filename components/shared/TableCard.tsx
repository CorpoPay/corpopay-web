import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TableCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export function TableCard({ children, className, title, action }: TableCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || action) && (
        <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
          {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      {/* Make table horizontally scrollable on mobile */}
      <div className="overflow-x-auto w-full">{children}</div>
    </Card>
  );
}
