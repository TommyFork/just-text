"use client";

import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ComboboxContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	value: string;
	onValueChange: (value: string) => void;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
}

const ComboboxContext = React.createContext<ComboboxContextValue | undefined>(
	undefined,
);

function useCombobox() {
	const context = React.useContext(ComboboxContext);
	if (!context) {
		throw new Error("useCombobox must be used within a Combobox");
	}
	return context;
}

interface ComboboxProps {
	children: React.ReactNode;
	value: string;
	onValueChange: (value: string) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

function Combobox({
	children,
	value,
	onValueChange,
	open: controlledOpen,
	onOpenChange,
}: ComboboxProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");

	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;

	return (
		<ComboboxContext.Provider
			value={{
				open,
				setOpen,
				value,
				onValueChange,
				searchQuery,
				setSearchQuery,
			}}
		>
			<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
				{children}
			</PopoverPrimitive.Root>
		</ComboboxContext.Provider>
	);
}

interface ComboboxTriggerProps {
	children: React.ReactNode;
	className?: string;
	placeholder?: string;
}

function ComboboxTrigger({
	children,
	className,
	placeholder,
}: ComboboxTriggerProps) {
	const { value } = useCombobox();

	return (
		<PopoverPrimitive.Trigger asChild>
			<button
				type="button"
				className={cn(
					"flex h-7 items-center justify-between gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-muted-foreground transition-colors hover:bg-white/[0.09] focus-visible:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
					className,
				)}
			>
				<span className="truncate">{value || placeholder}</span>
				<CaretDown className="size-3.5 shrink-0 opacity-50" />
			</button>
		</PopoverPrimitive.Trigger>
	);
}

interface ComboboxContentProps {
	children: React.ReactNode;
	className?: string;
	align?: "start" | "center" | "end";
}

function ComboboxContent({
	children,
	className,
	align = "end",
}: ComboboxContentProps) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				align={align}
				sideOffset={4}
				className={cn(
					"z-50 w-52 overflow-hidden rounded-lg border border-white/[0.07] bg-card p-1 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					className,
				)}
			>
				{children}
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	);
}

interface ComboboxSearchProps {
	placeholder?: string;
	className?: string;
}

function ComboboxSearch({
	placeholder = "Search...",
	className,
}: ComboboxSearchProps) {
	const { searchQuery, setSearchQuery } = useCombobox();
	const inputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (inputRef.current) {
			inputRef.current.focus();
		}
	}, []);

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 border-b border-white/[0.07] px-2 pb-1.5",
				className,
			)}
		>
			<MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground/50" />
			<input
				ref={inputRef}
				type="text"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				placeholder={placeholder}
				className="flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground/40"
				spellCheck={false}
			/>
		</div>
	);
}

interface ComboboxListProps {
	children: React.ReactNode;
	className?: string;
}

function ComboboxList({ children, className }: ComboboxListProps) {
	return (
		<div
			className={cn(
				"scrollbar-thin-dark max-h-48 overflow-y-auto py-1",
				className,
			)}
		>
			{children}
		</div>
	);
}

interface ComboboxItemProps {
	children: React.ReactNode;
	value: string;
	className?: string;
	onSelect?: () => void;
}

function ComboboxItem({
	children,
	value: itemValue,
	className,
	onSelect,
}: ComboboxItemProps) {
	const { value, onValueChange, setOpen } = useCombobox();
	const isSelected = value === itemValue;

	const handleClick = () => {
		onValueChange(itemValue);
		setOpen(false);
		onSelect?.();
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"relative flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none",
				isSelected ? "text-foreground" : "text-muted-foreground",
				className,
			)}
		>
			<span className="truncate">{children}</span>
			{isSelected && <Check className="size-3.5 shrink-0" />}
		</button>
	);
}

interface ComboboxEmptyProps {
	children: React.ReactNode;
	className?: string;
}

function ComboboxEmpty({ children, className }: ComboboxEmptyProps) {
	return (
		<div
			className={cn(
				"px-2 py-3 text-center text-xs text-muted-foreground/60",
				className,
			)}
		>
			{children}
		</div>
	);
}

export type {
	ComboboxContentProps,
	ComboboxEmptyProps,
	ComboboxItemProps,
	ComboboxListProps,
	ComboboxProps,
	ComboboxSearchProps,
	ComboboxTriggerProps,
};
export {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxSearch,
	ComboboxTrigger,
	useCombobox,
};
