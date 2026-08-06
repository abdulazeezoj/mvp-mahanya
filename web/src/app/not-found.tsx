import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      <p className="text-xs font-medium text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-xs text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button render={<Link href="/" />}>Back to dashboard</Button>
    </div>
  );
}
