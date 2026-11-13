import Image from "next/image";
import { branding } from "@/lib/branding";
import { cn } from "@/lib/utils";
import logo from "../../public/brand/vv-pernis-logo.png";

/** Officieel clublogo (aangeleverd 2026-11-12) met naam; afmetingen vast tegen layoutverschuiving. */
export function Brand({
  inverse = false,
  size = 48,
}: {
  inverse?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("brand", inverse && "brand-inverse")}>
      <Image
        src={logo}
        alt=""
        aria-hidden="true"
        height={size}
        width={Math.round((logo.width / logo.height) * size)}
        className="brand-logo"
        priority
      />
      <span className="brand-name">
        {branding.name}
        <span>{branding.product}</span>
      </span>
    </span>
  );
}
