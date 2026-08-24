import { Badge } from "@/components/ui/badge";
import { statusLabel, statusVariant } from "@/lib/status";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
