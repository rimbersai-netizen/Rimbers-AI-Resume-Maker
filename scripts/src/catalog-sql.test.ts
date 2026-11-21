import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogSql } from "./catalog-sql";

describe("catalog migration", () => {
  it("is in sync with the TypeScript template + country sources (run `pnpm gen:catalog`)", () => {
    const file = readFileSync(resolve(__dirname, "../../supabase/migrations/20261121000005_catalog.sql"), "utf8");
    expect(file).toBe(catalogSql());
  });
  it("contains all 105 templates as published and all 30 country rules as draft", () => {
    const sql = catalogSql();
    expect(sql.match(/, 'published', /g)).toHaveLength(105);
    expect(sql.match(/::jsonb, 'draft', /g)).toHaveLength(30);
  });
});
