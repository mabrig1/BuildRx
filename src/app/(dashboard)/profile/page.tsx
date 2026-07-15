import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { User } from "lucide-react";

import { ProfileForm } from "@/components/auth/profile-form";
import { SignOutButton } from "@/components/auth/signout-button";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const name =
    profile?.name ?? (user.user_metadata.name as string | undefined) ?? "";
  const avatarUrl =
    profile?.avatar_url ??
    (user.user_metadata.avatar_url as string | undefined) ??
    undefined;
  const provider = user.app_metadata.provider ?? "email";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Profile"
        description="Your account details and sign-in information."
      >
        <SignOutButton />
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarImage src={avatarUrl} alt={name || "Avatar"} />
              <AvatarFallback>
                <User className="size-6" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <CardTitle className="text-lg">{name || user.email}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <Badge variant="secondary" className="ml-auto capitalize">
              {provider}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Separator />
          <ProfileForm
            defaultValues={{ name, email: user.email ?? "" }}
          />
          <Separator />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatDate(user.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">
                {profile?.plan ?? "free"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize">
                {profile?.role ?? "user"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd className="font-medium">
                {user.last_sign_in_at
                  ? formatDate(user.last_sign_in_at)
                  : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
