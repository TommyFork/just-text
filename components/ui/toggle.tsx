"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
	"group/toggle inline-flex items-center justify-center gap-1 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-transparent rounded-4xl",
				outline:
					"border border-input bg-transparent hover:bg-muted rounded-4xl",
				"glass-outline":
					"bg-white/[0.04] text-muted-foreground hover:text-foreground border border-white/[0.08] rounded-lg aria-pressed:bg-white/[0.1] aria-pressed:text-foreground",
				"glass-default":
					"bg-white/[0.04] text-muted-foreground hover:text-foreground rounded-none aria-pressed:bg-white/[0.1] aria-pressed:text-foreground",
			},
			size: {
				default: "h-9 min-w-9 rounded-[min(var(--radius-2xl),12px)] px-2.5",
				sm: "h-8 min-w-8 px-3 rounded-lg",
				lg: "h-10 min-w-10 px-2.5 rounded-xl",
				xs: "h-6 px-3 text-xs rounded-md",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Toggle({
	className,
	variant = "default",
	size = "default",
	...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
	VariantProps<typeof toggleVariants>) {
	return (
		<TogglePrimitive.Root
			data-slot="toggle"
			className={cn(toggleVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Toggle, toggleVariants };
