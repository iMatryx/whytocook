import type { Metadata } from "next";
import { OrganizationView } from "@/features/recipes/presentation/organization-view";
export const metadata: Metadata = { title: "Favorite, colecții și istoric" };
export default function FavoritesPage() {
  return <OrganizationView />;
}
