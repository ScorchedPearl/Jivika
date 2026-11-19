import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AuthGuard from "./components/AuthGuard";
import { MapProvider } from "./context/MapContext";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

// Runs before paint so a saved theme doesn't flash the default one first
const themeInitScript = `try{var t=localStorage.getItem("theme");document.documentElement.className=["dark","light","rose","thunder"].indexOf(t)>-1?t:"light"}catch(e){document.documentElement.className="light"}`;

export const metadata: Metadata = {
  title: { default: "Jivika · AI health assistant", template: "%s · Jivika" },
  description:
    "Ask health questions, get scans and wound photos read by AI models, and find doctors and hospitals near you.",
  icons: { icon: "/images/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}>
        <GoogleOAuthProvider clientId="671966318930-hm29ojcbc0taqrq9o772d0ov8fabtcpu.apps.googleusercontent.com">
          <MapProvider>
          <ThemeProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
          </ThemeProvider>
          </MapProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
