import type { OpenAPIV3 } from "@scalar/openapi-types";

import { OperationTypeNames } from "./operation-type-names";

export function isV3HttpMethodOperationPair(
  entry: [string, any]
): entry is [OpenAPIV3.HttpMethods, OpenAPIV3.OperationObject] {
  if (!entry || !Array.isArray(entry) || entry.length < 2) {
    return false;
  }
  const [method, operation] = entry;
  return (
    OperationTypeNames.includes(method) &&
    typeof operation === "object" &&
    operation !== null
  );
}
