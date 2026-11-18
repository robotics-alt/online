import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f5f8fa' }, { media: '(prefers-color-scheme: dark)', color: '#141821' }],
};

export const metadata: Metadata = {
  title: "TutorSphere — Learn Anything. From Anywhere.",
  description:
    "Connect with expert tutors worldwide for personalized, interactive online lessons. Book, learn and track your progress in one place.",
  keywords: ["tutoring", "online lessons", "marketplace", "tutors", "learning", "TutorSphere"],
  authors: [{ name: "TutorSphere" }],
  openGraph: {
    title: "TutorSphere — Learn Anything. From Anywhere.",
    description: "Personalized, interactive online lessons with verified tutors worldwide.",
    siteName: "TutorSphere",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
