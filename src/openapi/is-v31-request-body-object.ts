import type { OpenAPIV3_1 } from "@scalar/openapi-types";

export function isV3_1RequestBodyObject(
  x: unknown
): x is OpenAPIV3_1.RequestBodyObject {
  return typeof x === "object" && x !== null;
}
