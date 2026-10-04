import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

const root = new URL("../", import.meta.url);
// Windows checkouts have CRLF line endings; compare as if every file used LF.
const read = (file: string) => readFileSync(fileURLToPath(new URL(file, root)), "utf8").replace(/\r\n/g, "\n");
const printer = ts.createPrinter({ removeComments: true });

function declarations(source: string): Map<string, string> {
  const file = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const declarations = new Map<string, string>();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          declarations.set(declaration.name.text, printer.printNode(ts.EmitHint.Unspecified, declaration.initializer, file));
        }
      }
    } else if (ts.isTypeAliasDeclaration(statement)) {
      declarations.set(`type ${statement.name.text}`, printer.printNode(ts.EmitHint.Unspecified, statement, file));
    }
  }
  return declarations;
}

it("keeps CONTRACTS §1–5 declarations identical to schema code, ignoring comments and formatting", () => {
  const doc = read("docs/CONTRACTS.md").split("## 6. Client functions")[0];
  const documented = declarations([...doc.matchAll(/```ts\n([\s\S]*?)```/g)].map(match => match[1]).join("\n"));
  const files = ["common", "ai/pageIndex", "ai/partsLayout", "ai/step", "saved", "scene", "api"];
  const actual = new Map(files.flatMap(file => [...declarations(read(`schema/${file}.ts`))]));
  expect(documented.size).toBeGreaterThan(40);
  expect([...actual.keys()].sort()).toEqual([...documented.keys()].sort());
  for (const [name, code] of documented) expect(actual.get(name), name).toBe(code);
});
