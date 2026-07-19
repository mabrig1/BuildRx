import { z } from "zod";

import { providerIdSchema } from "@/lib/validations/ai-platform";

/** Every document AI action (summarize/extract-tables/report/ask) can optionally override the document's default provider/model for that one call. */
export const documentAiOptionsSchema = z.object({
  provider: providerIdSchema.optional(),
  model: z.string().max(120).optional(),
});

export const askDocumentSchema = documentAiOptionsSchema.extend({
  question: z
    .string()
    .min(1, "Question cannot be empty")
    .max(2000, "Question must be at most 2,000 characters"),
});

export type DocumentAiOptionsInput = z.infer<typeof documentAiOptionsSchema>;
export type AskDocumentInput = z.infer<typeof askDocumentSchema>;
