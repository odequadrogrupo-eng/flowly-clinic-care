import { useState } from "react";

import { cn } from "@/lib/utils";

type ClinicLogoProps = {
  src?: string | null;
  alt: string;
  fallbackText?: string;
  className?: string;
  imgClassName?: string;
};

export function ClinicLogo({
  src,
  alt,
  fallbackText = "Club Medico",
  className,
  imgClassName,
}: ClinicLogoProps) {
  const [errored, setErrored] = useState(false);
  const canRenderImage = Boolean(src) && !errored;

  return (
    <div className={cn("flex items-center justify-center rounded-xl border bg-white px-2 py-1", className)}>
      {canRenderImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          onError={() => setErrored(true)}
          className={cn("h-10 w-auto object-contain", imgClassName)}
        />
      ) : (
        <span className="text-sm font-semibold text-slate-700">{fallbackText}</span>
      )}
    </div>
  );
}
