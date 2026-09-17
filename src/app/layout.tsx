import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OldStar Ops",
  description: "OldStar internal operations & returns tool",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  );
}
