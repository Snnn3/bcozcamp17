import { describe, expect, it } from "vitest";
import { permissionSeeds } from "../../packages/db/prisma/seed";

describe("synthetic seed contract", () => {
  it("contains all nine independent capability codes", () => {
    expect(permissionSeeds.map(({ code }) => code)).toEqual([
      "application_read",
      "document_read",
      "document_review",
      "internal_note_read",
      "internal_note_write",
      "application_final_decision",
      "export_applications",
      "configuration_manage",
      "permissions_manage",
    ]);
  });
});
