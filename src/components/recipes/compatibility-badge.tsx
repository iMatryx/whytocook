import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

import { compatibilityLabels, type CompatibilityStatus } from "./compatibility";

export function CompatibilityBadge({ status }: { status: CompatibilityStatus }) {
  const tone = status === "ready" ? "success" : status === "check-quantities" ? "warning" : "neutral";
  return <Badge tone={tone}><Icon name={status === "ready" ? "check" : status === "check-quantities" ? "alert" : "info"} className="size-3.5" />{compatibilityLabels[status]}</Badge>;
}
