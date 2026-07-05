import "./globals.css";
import type { ReactNode } from "react";
import { GlobalLanguageSwitch } from "../components/global-language-switch";
import { LocaleProvider } from "../lib/i18n";

export const metadata = {
  title: "Workforce Execution Platform",
  description: "MVP case study desktop app",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <LocaleProvider>
          <GlobalLanguageSwitch />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
