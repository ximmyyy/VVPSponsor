"use client";

// Gebaseerd op shadcn/ui Sheet (Radix Dialog, MIT); Nederlandse bediening,
// grotere aanraakdoelen en geen verplichte animatie-library.
import type { ComponentProps } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({
  children,
  className,
  ...props
}: ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(21rem,calc(100%-2rem))] flex-col overflow-y-auto bg-sidebar text-sidebar-foreground shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className="sheet-close absolute right-3 top-3 flex size-11 items-center justify-center rounded-md hover:bg-white/10"
          aria-label="Navigatie sluiten"
        >
          <X className="size-5" aria-hidden="true" />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
