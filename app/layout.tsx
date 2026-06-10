import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAHJONY · Control Plane",
  description: "Hybrid cloud/local executive control plane",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
