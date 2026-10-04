import { describe, expect, it } from "vitest";
import { fileProblem, formatUsd, idFromTitle, INTERIM_PRODUCT_SIZE_CM, overallProgress, slugify, stageLabel, titleFromFileName } from "@/client/uploadForm";
import { ProductSizeCm, SavedManual } from "@/schema";

describe("titleFromFileName", () => {
  it("reads the product name out of IKEA's own file names", () => {
    expect(titleFromFileName("malm-bed-frame-white__AA-2558683-1-100.pdf")).toBe("MALM bed frame white");
    expect(titleFromFileName("kallax-shelf-unit-white__AA-1055145-11_pub.pdf")).toBe("KALLAX shelf unit white");
  });

  it("copes with other names", () => {
    expect(titleFromFileName("MANUAL.pdf")).toBe("MANUAL");
    expect(titleFromFileName("My Lack_Table.PDF")).toBe("MY lack table");
    expect(titleFromFileName(".pdf")).toBe("Uploaded manual");
    expect(titleFromFileName("__AA-1.pdf")).toBe("Uploaded manual");
  });
});

describe("slugify and idFromTitle", () => {
  it("makes an id the saved-manual schema accepts, whatever the title", () => {
    for (const title of ["KALLAX 2×4 shelving unit", "MALM bed frame white", "  LACK  side table!! ", "Hyllis Ä/Ö 60×27×140 cm, in- and outdoor shelving", "!!!", ""]) {
      expect(SavedManual.shape.id.safeParse(idFromTitle(title)).success).toBe(true);
    }
  });

  it("turns the title into lowercase words joined by dashes", () => {
    expect(slugify("KALLAX 2×4 shelving unit")).toBe("kallax-2x4-shelving-unit");
    expect(slugify("  LACK  side table!! ")).toBe("lack-side-table");
    expect(slugify("Ä-Ö")).toBe("a-o");
  });

  it("cuts long titles at 40 characters without a trailing dash", () => {
    const slug = slugify("a very long product title that keeps going and going and going");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to a plain id when the title has nothing usable", () => {
    expect(idFromTitle("!!!")).toBe("manual");
  });
});

describe("fileProblem", () => {
  it("accepts a PDF and explains what is wrong with anything else", () => {
    expect(fileProblem({ name: "kallax.pdf", size: 1_500_000 })).toBeNull();
    expect(fileProblem({ name: "MANUAL.PDF", size: 10 })).toBeNull();
    expect(fileProblem({ name: "photo.png", size: 10 })).toBe("This file isn't a PDF. Upload the assembly manual as a PDF.");
    expect(fileProblem({ name: "empty.pdf", size: 0 })).toBe("This file is empty.");
  });
});

describe("the interim product size", () => {
  it("is a valid size, and the KALLAX 2×4 the mock answers with", () => {
    expect(ProductSizeCm.safeParse(INTERIM_PRODUCT_SIZE_CM).success).toBe(true);
    expect(INTERIM_PRODUCT_SIZE_CM).toEqual([77, 147, 39]);
  });
});

describe("stageLabel", () => {
  it("names each stage, with a count where there is one", () => {
    expect(stageLabel("rasterize", null)).toBe("Reading the PDF");
    expect(stageLabel("index", { done: 3, total: 24 })).toBe("Finding the steps · page 4 of 24");
    expect(stageLabel("index", { done: 24, total: 24 })).toBe("Cutting out the steps");
    expect(stageLabel("parts", { done: 24, total: 24 })).toBe("Identifying the parts");
    expect(stageLabel("steps", { done: 6, total: 19 })).toBe("Analysing step 7 of 19");
    expect(stageLabel("steps", { done: 19, total: 19 })).toBe("Analysing step 19 of 19");
    expect(stageLabel("done", null)).toBe("Done");
  });
});

describe("overallProgress", () => {
  it("starts at 0 and ends at 1", () => {
    expect(overallProgress("rasterize", null)).toBe(0);
    expect(overallProgress("done", null)).toBe(1);
    expect(overallProgress("steps", { done: 19, total: 19 })).toBe(1);
  });

  it("never goes backwards through a whole run", () => {
    const run: [Parameters<typeof overallProgress>[0], { done: number; total: number } | null][] = [
      ["rasterize", null],
      ["index", null],
      ...Array.from({ length: 24 }, (_, i): ["index", { done: number; total: number }] => ["index", { done: i + 1, total: 24 }]),
      ["parts", null],
      ["steps", null],
      ...Array.from({ length: 19 }, (_, i): ["steps", { done: number; total: number }] => ["steps", { done: i + 1, total: 19 }]),
      ["done", null],
    ];
    const values = run.map(([stage, progress]) => overallProgress(stage, progress));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it("gives most of the bar to analysing the steps", () => {
    expect(overallProgress("steps", null)).toBeLessThan(0.3);
    expect(overallProgress("steps", { done: 10, total: 20 })).toBeCloseTo(0.64);
  });
});

describe("formatUsd", () => {
  it("shows two decimals, and zero when there is no usage yet", () => {
    expect([formatUsd(0.2149), formatUsd(undefined), formatUsd(1)]).toEqual(["$0.21", "$0.00", "$1.00"]);
  });
});
