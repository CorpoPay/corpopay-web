import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPrev, onNext, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ""}`}>
      <Button variant="outline" size="sm" disabled={page === 0} onClick={onPrev} className="gap-1">
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Page <span className="font-medium text-foreground">{page + 1}</span> of{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages - 1}
        onClick={onNext}
        className="gap-1"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
