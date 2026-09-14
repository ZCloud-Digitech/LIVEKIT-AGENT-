import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Z Call Agent — Realtime AI Voice Agent SaaS Control Plane',
  description: 'Enterprise multi-tenant platform for orchestrating, configuring, and monitoring LiveKit-powered AI voice agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
