import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Join class names, letting a later Tailwind utility win over an earlier one
 * that sets the same property. shadcn/ui and the registry parts (Magic UI,
 * React Bits) are written against this helper; see components.json.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
