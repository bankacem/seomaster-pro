import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  variants: {
    default: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
    gradient: "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm hover:from-brand-700 hover:to-brand-600",
    outline: "border border-ink-200 bg-white text-ink-800 shadow-sm hover:bg-ink-50 hover:text-ink-900",
    ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
    secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200",
    destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    link: "text-brand-600 underline-offset-4 hover:underline",
  },
  sizes: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3 text-xs",
    lg: "h-11 rounded-lg px-6 text-base",
    icon: "h-10 w-10",
    "icon-sm": "h-9 w-9",
  },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants.variants;
  size?: keyof typeof buttonVariants.sizes;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants.base, buttonVariants.variants[variant], buttonVariants.sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
