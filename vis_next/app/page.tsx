import { SiteShell } from "./components/Site/SiteShell";
import { Hero } from "./components/Home/Hero";
import { WhatItDoes } from "./components/Home/WhatItDoes";
import { HowItWorks } from "./components/Home/HowItWorks";
import { SampleChat } from "./components/Home/SampleChat";
import { ForEveryone } from "./components/Home/ForEveryone";
import { TechStack } from "./components/Home/TechStack";
import { FAQ } from "./components/Home/FAQ";
import { StartCta } from "./components/Home/StartCta";

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <WhatItDoes />
      <HowItWorks />
      <SampleChat />
      <ForEveryone />
      <TechStack />
      <FAQ />
      <StartCta />
    </SiteShell>
  );
}
