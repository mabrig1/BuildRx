import { z } from "zod";

export const generateTextSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(8000, "Prompt must be at most 8,000 characters"),
  system: z.string().max(4000).optional(),
  projectId: z.string().uuid().optional(),
  model: z.string().max(120).optional(),
  maxTokens: z.number().int().min(1).max(16384).optional(),
  temperature: z.number().min(0).max(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  seed: z.number().int().optional(),
  stream: z.boolean().default(true),
});

export const generateCodeSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(8000, "Prompt must be at most 8,000 characters"),
  language: z.string().max(40).optional(),
  context: z
    .string()
    .max(16000, "Context must be at most 16,000 characters")
    .optional(),
  projectId: z.string().uuid().optional(),
  stream: z.boolean().default(true),
});

export type GenerateTextInput = z.infer<typeof generateTextSchema>;
export type GenerateCodeInput = z.infer<typeof generateCodeSchema>;

/** Rough cap on a base64 data URL — keeps oversized uploads from tying up a request. */
const imageDataUrlSchema = z
  .string()
  .startsWith("data:image/", "Must be an image data URL")
  .max(8_000_000, "Image is too large (max ~6MB)");

export const visionSchema = z.object({
  imageDataUrl: imageDataUrlSchema,
  prompt: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
});

export const parseDocumentSchema = z.object({
  imageDataUrl: imageDataUrlSchema,
  prompt: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
});

export const moderateSchema = z.object({
  text: z.string().min(1).max(8000),
});

export const planSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(4000, "Prompt must be at most 4,000 characters"),
  context: z.string().max(16000).optional(),
  projectId: z.string().uuid().optional(),
});

export const generateImageSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(2000, "Prompt must be at most 2,000 characters"),
  negativePrompt: z.string().max(500).optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
  seed: z.number().int().optional(),
  projectId: z.string().uuid().optional(),
});

export type VisionInput = z.infer<typeof visionSchema>;
export type ParseDocumentInput = z.infer<typeof parseDocumentSchema>;
export type ModerateInput = z.infer<typeof moderateSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type GenerateImageInput = z.infer<typeof generateImageSchema>;
