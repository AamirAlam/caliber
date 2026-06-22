import { Architecture } from '@/components/Architecture';
import { CtaFooter } from '@/components/CtaFooter';
import { Explanation } from '@/components/Explanation';
import { Guardrails } from '@/components/Guardrails';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { SiteHeader } from '@/components/SiteHeader';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Explanation />
        <HowItWorks />
        <Architecture />
        <Guardrails />
      </main>
      <CtaFooter />
    </>
  );
}
