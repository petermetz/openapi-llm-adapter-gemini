/**
 * Turns a `snake_case` input of `this_is_a_snake_case_string` into 
 * `thisIsASnakeCaseString` which is `camelCase`.
 * 
 * Drops special characters from the string as well, only alphanumeric characters
 * are left in the final output.
 *
 * @param aString 
 * @returns 
 */
export function snakeToCamel(aString: Readonly<string>): string {
  if (typeof aString !== "string") {
    throw new Error("[snakeToCamel] arg aString is not a string ");
  }
  return aString.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace("-", "").replace("_", "")
  );
}
