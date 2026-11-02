import type { IconName } from "@/components/ui/icon";

export type ShellPageContent = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: IconName;
};

export const shellPages = {
  recipes: {
    title: "Rețete",
    description: "Idei de gătit, pornind de la ingredientele pe care le ai.",
    emptyTitle: "Catalogul de rețete se pregătește",
    emptyDescription:
      "Aici vei putea descoperi rețete, ingredientele necesare și timpul de preparare.",
    icon: "book",
  },
  fridge: {
    title: "Frigiderul meu",
    description: "Un loc pentru alimentele din frigider, congelator și cămară.",
    emptyTitle: "Frigiderul virtual este în pregătire",
    emptyDescription:
      "Vei putea adăuga alimente, cantități și date, apoi vei vedea ce poți găti cu ele.",
    icon: "fridge",
  },
  planner: {
    title: "Planificator de mese",
    description: "Organizează mesele săptămânii într-un singur loc.",
    emptyTitle: "Planificarea meselor se pregătește",
    emptyDescription: "Aici vei putea alege rețete, zile și porții pentru mesele tale.",
    icon: "calendar",
  },
  shopping: {
    title: "Lista de cumpărături",
    description: "Ingredientele de care mai ai nevoie, într-o listă ușor de urmărit.",
    emptyTitle: "Lista de cumpărături este în pregătire",
    emptyDescription:
      "Vei putea aduna ingredientele lipsă din mesele planificate și adăuga elemente proprii.",
    icon: "basket",
  },
  favorites: {
    title: "Favorite",
    description: "Rețetele la care vrei să revii.",
    emptyTitle: "Spațiul pentru favorite se pregătește",
    emptyDescription: "Aici vei găsi rețetele salvate, după activarea conturilor și a catalogului.",
    icon: "heart",
  },
  assistant: {
    title: "Asistent",
    description: "Ajutor pentru adaptarea ideilor de gătit la preferințele tale.",
    emptyTitle: "Asistentul este în pregătire",
    emptyDescription:
      "Asistența AI va fi disponibilă într-o etapă viitoare. Aici nu sunt trimise sau generate mesaje.",
    icon: "sparkles",
  },
  profile: {
    title: "Profil",
    description: "Preferințele și setările contului tău.",
    emptyTitle: "Profilul va fi disponibil după autentificare",
    emptyDescription:
      "Conturile nu sunt încă activate. Această pagină nu încarcă și nu afișează date personale.",
    icon: "user",
  },
  login: {
    title: "Autentificare",
    description: "Acces la inventar, favorite și planificarea meselor.",
    emptyTitle: "Autentificarea este în pregătire",
    emptyDescription:
      "Conectarea și crearea conturilor nu sunt încă disponibile. Nu este necesar să introduci date de acces.",
    icon: "user",
  },
  admin: {
    title: "Administrare",
    description: "Spațiul pentru întreținerea catalogului Cookly.",
    emptyTitle: "Administrarea nu este activată",
    emptyDescription:
      "Aceasta este o pagină de prezentare a structurii. Nu oferă acces la date, roluri sau operațiuni de administrare.",
    icon: "settings",
  },
  recipeDetails: {
    title: "Detalii rețetă",
    description: "Ingredientele, pașii și estimările unei rețete, într-un singur loc.",
    emptyTitle: "Pagina de rețetă se pregătește",
    emptyDescription:
      "Catalogul nu este încă conectat. Această previzualizare nu încarcă o rețetă și nu afișează cantități sau estimări inventate.",
    icon: "book",
  },
} as const satisfies Record<string, ShellPageContent>;
