import type { OpenAPIV3 } from "@scalar/openapi-types";

export function isV3ParameterObject(
  obj: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject
): obj is OpenAPIV3.ParameterObject {
  return !("$ref" in obj);
}
