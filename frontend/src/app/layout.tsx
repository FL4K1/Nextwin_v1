import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";

// Removed Google Font Inter to bypass build issue in sandbox
// Standard system font stack used in globals.css

export const metadata: Metadata = {
  title: "NexTwin | Digital Twin Healthcare Platform",
  description: "AI-powered decentralized healthcare intelligence system with real-time digital twin monitoring, predictive analytics, and secure doctor consultations.",
  keywords: "healthcare, digital twin, AI, telemedicine, wearable data, Web3",
};

import { Web3Provider } from "@/lib/web3";

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans antialiased bg-[#0a0a1a] text-white`}>
        <AuthProvider>
          <Web3Provider>
            <RealtimeProvider>
              <Toaster position="bottom-right" theme="dark" />
              {children}
            </RealtimeProvider>
          </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  );
}
