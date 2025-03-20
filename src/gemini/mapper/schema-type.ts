/**
 *
 * We define our own version of the OpenAPI data types here so that we don't
 * have to import the `"@google/generative-ai"` library as a runtime dependency
 * just for using the SchemaType constants that they have defined in
 * there which are just mimicking the OpenAPI data types anyway.
 *
 * The relevant types from the OpenAPI Typescript types:
 * ```typescript
 * type NonArraySchemaObjectType = 'boolean' | 'object' | 'number' | 'string' | 'integer';
 * type ArraySchemaObjectType = 'array';
 * ```
 *
 * @see https://swagger.io/docs/specification/v3_0/data-models/data-types/
 */
export enum SchemaType {
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  BOOLEAN = "boolean",
  ARRAY = "array",
  OBJECT = "object",
}
