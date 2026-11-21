import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogSql } from "./catalog-sql";

export const CATALOG_FILE = resolve(import.meta.dirname, "../../supabase/migrations/20261121000005_catalog.sql");
writeFileSync(CATALOG_FILE, catalogSql());
console.log(`wrote ${CATALOG_FILE}`);
