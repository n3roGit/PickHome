import { RatingProgressBar } from "@/components/RatingProgressBar";

export function ChecklistProgressBar({
  filled,
  total,
  className = "",
}: {
  filled: number;
  total: number;
  className?: string;
}) {
  if (total <= 0) return null;
  return (
    <RatingProgressBar
      rated={filled}
      total={total}
      label="Checkliste"
      className={className}
    />
  );
}
