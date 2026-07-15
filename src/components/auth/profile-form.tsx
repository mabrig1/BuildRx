"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateProfile } from "@/app/(dashboard)/profile/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { profileSchema, type ProfileInput } from "@/lib/validations/settings";

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: ProfileInput;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  function onSubmit(values: ProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(values);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" disabled {...field} />
              </FormControl>
              <FormDescription>
                Your email is managed by your sign-in method and can&apos;t be
                changed here.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
