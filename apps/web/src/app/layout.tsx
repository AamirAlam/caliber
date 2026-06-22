import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helm — AI treasury control plane for RWAs',
  description:
    'Helm is a policy-driven AI treasury control plane for tokenized real-world assets. It watches signals, reasons about risk and policy, and executes approved on-chain rebalances on Casper with a full audit trail.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
