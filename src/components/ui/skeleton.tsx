import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("skeleton rounded-md bg-secondary", className)}
      {...props}
    />
  );
}
