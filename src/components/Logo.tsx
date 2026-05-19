import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/pickhome-logo.png"
      alt="PickHome"
      width={160}
      height={48}
      className={className ?? "h-10 w-auto"}
      priority
    />
  );
}