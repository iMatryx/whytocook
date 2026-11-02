"use client";

import { ErrorState } from "@/components/feedback/error-state";

export default function ShellError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Pagina nu s-a putut încărca</h1>
      <ErrorState
        title="Conținut indisponibil temporar"
        description="Încearcă din nou sau alege o altă secțiune din meniu."
        onRetry={reset}
      />
    </div>
  );
}
