import { branding } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={cn("brand", inverse && "brand-inverse")}>
      <span className="brand-mark" aria-hidden="true">
        VV
        <span className="brand-dot" />
      </span>
      <span className="brand-name">
        {branding.name}
        <span>{branding.product}</span>
      </span>
    </span>
  );
}
