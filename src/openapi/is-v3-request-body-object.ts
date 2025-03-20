import type { OpenAPIV3 } from "@scalar/openapi-types";

export function isV3RequestBodyObject(
  x: unknown
): x is OpenAPIV3.RequestBodyObject {
  return typeof x === "object" && x !== null && "content" in x;
}
