import type { OpenAPIV3 } from "@scalar/openapi-types";

export function isV3ReferenceObject(
  x: unknown
): x is OpenAPIV3.ReferenceObject {
  return typeof x === "object" && x !== null && "$ref" in x;
}
