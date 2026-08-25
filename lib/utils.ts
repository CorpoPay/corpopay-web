import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(amount: number | string, currency = "MAD"): string {
  return `${Number(amount).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("fr-MA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
