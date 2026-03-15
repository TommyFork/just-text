import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center px-4">
			<h1 className="text-2xl font-bold text-foreground">Not found</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				This paste doesn&apos;t exist, has expired, or was burned after reading.
			</p>
			<Link
				href="/"
				className="mt-6 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
			>
				Create a new paste
			</Link>
		</div>
	);
}
