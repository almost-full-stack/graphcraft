const camelCase = require('camelcase');

/**
 * Generates a standardized name string based on a template, a set of replacements,
 * a dictionary of default values, and casing options.
 *
 * The function replaces placeholders (tokens) within the template in the form `{token}`
 * with corresponding values from the `replacements` object or `dictionary`.
 *
 * If a required token is not found in either `replacements` or `dictionary`,
 * the function will throw an error.
 *
 * @param {Object} params - Parameters for generating the name.
 * @param {string} params.template - The template string containing `{tokens}` to replace.
 * @param {Object} [params.replacements={}] - An object providing values to replace tokens.
 * @param {Object} [params.dictionary={}] - A fallback object for token values not provided in replacements.
 * @param {Object} [params.options={ pascalCase: true, noCase: false }] - Casing options.
 * @param {boolean} [params.options.pascalCase=true] - Whether to return PascalCase (first letter capitalized).
 * @param {boolean} [params.options.noCase=false] - Whether to return the result without applying any casing.
 *
 * @returns {string} The generated and formatted name string.
 *
 * @throws {Error} If the template is empty or if a required token is missing.
 *
 * @example
 * generateName({
 *   template: '{name}{operation}',
 *   replacements: { name: 'user', operation: 'create' },
 *   dictionary: {},
 *   options: { pascalCase: true }
 * });
 * // Returns: 'UserCreate'
 */

function generateName({
  template = '',
  replacements = {},
  dictionary = {},
  options = { pascalCase: true, noCase: false },
}) {

  console.log('template', template);

  if (!template) {
    throw new Error('Template must be a non-empty string.');
  }

  const filled = template.replace(/{([^}]+)}/g, (_, token) => {
    const value = replacements[token] || dictionary[token];

    if (value === undefined) {
      throw new Error(`Missing value for token: "${token}"`);
    }

    return value;
  });

  if (options.noCase) {
    return filled.replace(/[^a-zA-Z0-9]/g, '');
  }

  return camelCase(filled, { pascalCase: options.pascalCase });
}

module.exports = generateName;