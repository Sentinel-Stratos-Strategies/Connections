import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline" | "muted";
}

export function Badge({ 
  className, 
  variant = "default", 
  ...props 
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-primary/20 text-primary border border-primary/30": variant === "default",
          "bg-success/20 text-success border border-success/30": variant === "success",
          "bg-warning/20 text-warning border border-warning/30": variant === "warning",
          "bg-danger/20 text-danger border border-danger/30": variant === "danger",
          "border border-border text-muted": variant === "outline",
          "bg-surface text-muted": variant === "muted",
        },
        className
      )}
      {...props}
    />
  );
}
