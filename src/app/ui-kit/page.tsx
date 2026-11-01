import type { Metadata } from "next";

import { UiKitGallery } from "@/components/design-system/ui-kit-gallery";

export const metadata: Metadata = {
  title: "Design system",
  description: "Componentele și regulile vizuale Cookly. Galerie de referință cu date fictive.",
  robots: { index: false, follow: false },
};

export default function UiKitPage() {
  return <UiKitGallery />;
}
