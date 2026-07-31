import { IBM_Plex_Mono, Lora, Open_Sans } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import type { Locale } from "@/lib/i18n";
import "@/app/globals.css";

// The one <html>/<body> shell both root layouts render. Each locale's route
// group owns a root layout solely to set the correct page-level language
// (feature 010, research R1); everything else — fonts, theme, header — is
// shared here so the two layouts cannot drift.

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "vietnamese"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export function RootShell({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  return (
    <html
      lang={lang}
      className={`${openSans.variable} ${lora.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
