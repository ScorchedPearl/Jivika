import { LinkButton } from "./components/Site/LinkButton";
import { SiteShell } from "./components/Site/SiteShell";

export default function NotFound() {
  return (
    <SiteShell footer={false}>
      <section className="-mt-16 bg-glow pt-16">
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
          <p className="font-mono text-xs tracking-wider text-brand uppercase">404</p>
          <h1 className="mt-3 font-serif text-4xl text-foreground sm:text-5xl">We couldn&apos;t find that page</h1>
          <p className="mt-3 max-w-md text-muted-foreground">It may have moved, or the link might be wrong.</p>
          <LinkButton href="/" className="mt-7">Back to home</LinkButton>
        </div>
      </section>
    </SiteShell>
  );
}
