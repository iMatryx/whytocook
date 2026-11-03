import type { Metadata } from "next";
import { PantryView } from "@/features/pantry/presentation/pantry-view";
export const metadata: Metadata = { title: "Frigiderul meu" };
export default function FridgePage() {
  return <PantryView />;
}
