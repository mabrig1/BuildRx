import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(150),
});

export const createInviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["admin", "member"]).default("member"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const shareProjectSchema = z.object({
  teamId: z.string().uuid().nullable(),
});
