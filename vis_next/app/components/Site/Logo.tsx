import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Jivika home" className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/images/logo.png" alt="" width={28} height={28} priority className="rounded-full" />
      <span className="font-serif text-xl tracking-tight text-foreground">Jivika</span>
    </Link>
  );
}
