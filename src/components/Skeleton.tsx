import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton rounded bg-[#23262A]", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
      <Skeleton className="mb-3 h-6 w-1/2" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
