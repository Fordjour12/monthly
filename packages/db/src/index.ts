import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL || "",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle({ client, schema });

// Export drizzle operators
export { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
// Export query utilities
export * from "./queries";
// Export all schema tables and relations
export * from "./schema";
// Export all types
export * from "./types";
