import { cn } from "@/lib/utils";

// Pastille d'initiales pour un patient. Teinte déterministe (dérivée du nom)
// dans une palette douce et professionnelle, pour repérer les patients d'un
// coup d'œil sans surcharger la charte.

const PALETTE = [
  "bg-[#F7ECEC] text-[#8E0D15]", // rose cardinal (charte)
  "bg-[#EAF1F7] text-[#2A5578]", // ardoise
  "bg-[#EAF4EE] text-[#1E7D52]", // vert clinique
  "bg-[#F3EFF7] text-[#5B3E82]", // violet doux
  "bg-[#FBF1E7] text-[#9B6400]", // ambre
  "bg-[#EAF5F5] text-[#0F6E6B]", // sarcelle
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export function PatientAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        PALETTE[hue(name)],
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
