import { z } from "zod";

export const bookSchema = z.object({
  title: z
    .string({ error: "A book needs a title" })
    .trim()
    .min(1, { error: "A book needs a title" }),

  genre: z.string().nullable().optional(),

  published_year: z
    .number()
    .int()
    .nullable()
    .optional(),

  author_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
});

export const bookPatchSchema = bookSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be sent",
    }
  );

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type Book = z.infer<typeof bookSchema> & {
  id: number;
};