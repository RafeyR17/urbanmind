import type { Metadata } from "next";
import localFont from "next/font/local";
import './globals.css'; // geist + dossier tokens live here

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "UrbanIQ — Lahore policy sim",
  description: "simulate infrastructure on lahore's digital twin before spending billions",
};

// TODO: add og:image before we share this publicly
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-bg-primary text-slate-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
