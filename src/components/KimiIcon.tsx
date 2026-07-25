interface KimiIconProps {
  className?: string;
  size?: number;
}

export function KimiIcon({ className, size = 20 }: KimiIconProps) {
  return (
    <img
      src="/kimi-icon.jpg"
      alt="Kimi"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "cover" }}
    />
  );
}
