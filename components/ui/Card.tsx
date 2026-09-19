"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));
const cardStyles = cva("rounded-xl text-slate-100", { variants: { variant: { default: "bg-slate-900", outlined: "border border-slate-800 bg-slate-900/50", elevated: "bg-slate-900 shadow-xl shadow-black/20" } }, defaultVariants: { variant: "default" } });

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardStyles> { hover?: boolean; }
export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, variant, hover = false, ...props }, ref) => <div ref={ref} className={cn(cardStyles({ variant }), hover && "transition duration-200 hover:-translate-y-0.5 hover:shadow-lg", className)} {...props} />);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center justify-between gap-4 p-6 pb-3", className)} {...props} />);
CardHeader.displayName = "CardHeader";
export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-3", className)} {...props} />);
CardBody.displayName = "CardBody";
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center gap-3 p-6 pt-3", className)} {...props} />);
CardFooter.displayName = "CardFooter";
