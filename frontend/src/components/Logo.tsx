"use client";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#171717" />
      <text
        x="16"
        y="19"
        textAnchor="middle"
        fill="white"
        fontSize="20"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ fontStyle: "normal" }}
      >
        ρ
      </text>
    </svg>
  );
}

export function LogoSmall({ className = "" }: { className?: string }) {
  return <Logo size={24} className={className} />;
}

export function LogoLarge({ className = "" }: { className?: string }) {
  return <Logo size={32} className={className} />;
}
