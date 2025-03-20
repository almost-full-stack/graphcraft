/**
 * Sanitizes a given input string by removing all special characters and spaces.
 *
 * Rules:
 * - Input must be a non-null string.
 * - Input cannot start with a number.
 * - Input cannot be empty after sanitization.
 * - Removes all non-alphanumeric characters.
 *
 * @param {string} input - The string to be sanitized.
 * @returns {string} - The sanitized string containing only alphanumeric characters.
 * @throws {Error} If the input is not a string.
 * @throws {Error} If the input starts with a number.
 * @throws {Error} If the sanitized string is empty.
 */

function sanitizeString(input) {
  if (typeof input !== 'string') {
    throw new Error(`Value: ${input} must be a non-null string`);
  }

  if ((/^\d/).test(input)) {
    throw new Error(`Value: ${input} cannot start with a number`);
  }

  const sanitized = input.replace(/[^a-zA-Z0-9]/g, '');

  if (sanitized.length === 0) {
    throw new Error(`Value: ${input} cannot be empty`);
  }

  return sanitized;
}

/**
 * Determines the type of field array based on the given name format.
 *
 * Rules:
 * - Returns 3 if the name starts with '[' and ends with '!]'.
 * - Returns 2 if the name starts with '[' and ends with ']!'.
 * - Returns 1 if the name starts with '[' and ends with ']'.
 * - Returns 0 otherwise.
 *
 * @param {string} name - The field name to be checked.
 * @returns {number} - A number representing the type of field array.
 */
function isFieldArray(name) {
  if (typeof name !== 'string') {
      throw new Error('Input must be a string');
  }

  if (name.startsWith('[')) {
      if (name.endsWith('!]')) return 3;
      if (name.endsWith(']!')) return 2;
      if (name.endsWith(']')) return 1;
  }

  return 0;
}

function isFieldRequired (name) {
  return name.indexOf('!') > -1;
}

module.exports = {
  sanitizeString,
  isFieldArray,
  isFieldRequired
};