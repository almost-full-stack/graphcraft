const camelCase = require('camelcase');

function isFieldArray (name) {
  if (name.startsWith('[') && name.endsWith('!]')) return 3;
  if (name.startsWith('[') && name.endsWith(']!')) return 2;
  if (name.startsWith('[') && name.endsWith(']')) return 1;

  return 0;
}

function isFieldRequired (name) {
  return name.indexOf('!') > -1;
}

const sanitizeField = (name = '') => {

  if (name === '' || !name) throw Error('Invalid field name provided.');

  name = name.replace('[', '').replace(']', '').replace('!', '');

  if (name === '') throw Error('Invalid field name provided.');

  return name;
};

const tokenizeTemplate = (template, all) => {

  if (template.indexOf('{') === -1) {
    all.push(template);

    return;
  }

  const token = template.substr(0, template.indexOf(template.startsWith('{') ? '}' : '{') + (template.startsWith('{') ? 1 : 0));

  template = template.replace(token, '');
  all.push(token);
  tokenizeTemplate(template, all);
};

const generateName = (nameTemplate = '', map = {}, options = {}) => {

  if (nameTemplate === '' || nameTemplate === null) throw Error('Invalid name template.');

  const names = [];

  tokenizeTemplate(nameTemplate, names);

  return camelCase(names.map((name) => {

    if (!name.startsWith('{')) return name;

    name = name.replace('{', '').replace('}', '');

    return map[name] || '';
  }), { pascalCase: options.pascalCase });

};

function isAvailable(exposed, toBeGenerated) {

  const toGenerate = [].concat(toBeGenerated);

  if (!exposed.length) return true;

  for (let index = 0; index < toGenerate.length; index++) {
    if (exposed.includes(toGenerate[index])) {
      return true;
    }
  }

  return false;

}

module.exports = {
  isFieldArray,
  isFieldRequired,
  sanitizeField,
  generateName,
  isAvailable
};