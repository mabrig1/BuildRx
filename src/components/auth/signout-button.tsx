"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => signOut())}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Sign out
    </Button>
  );
}
