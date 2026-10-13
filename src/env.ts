import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DB_USER: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_DATABASE: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  PORT: z.coerce.number().default(3000),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");
  console.error(z.treeifyError(result.error));
  process.exit(1);
}

export const env = result.data;