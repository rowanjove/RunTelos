import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
const tokens = readFileSync(
  join(process.cwd(), "src", "styles", "tokens.css"),
  "utf8",
);

describe("theme tokens and controls", () => {
  it("defines surfaces and borders for themes", () => {
    expect(tokens).toMatch(/--surface:/);
    expect(tokens).toMatch(/--surface-raised:/);
    expect(tokens).toMatch(/--border:/);
  });

  it("defines radius and spacing scales", () => {
    expect(tokens).toMatch(/--space-1:\s*4px;/);
    expect(tokens).toMatch(/--radius-sm:\s*5px;/);
    expect(tokens).toMatch(/--font-family:/);
  });
});
describe("viewport containment", () => {
  it("prevents fixed-size app chrome from exposing stray page scrollbars", () => {
    expect(styles).toMatch(/html, body, #root \{[^}]*overflow:\s*hidden;/s);
  });
});

describe("components styling", () => {
  it("defines titlebar, task card, and command palette styles", () => {
    expect(styles).toContain(".titlebar {");
    expect(styles).toContain(".task-card {");
    expect(styles).toContain(".palette-modal {");
    expect(styles).toContain(".dialog-modal {");
  });
});
