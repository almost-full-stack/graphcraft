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

const sanitizeField = (name) => {
  return name.replace('[', '').replace(']', '').replace('!', '');
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

  if (nameTemplate === '') throw Error('Invalid name template.');

  const names = [];

  tokenizeTemplate(nameTemplate, names);

  return camelCase(names.map((name) => {

    if (!name.startsWith('{')) return name;

    name = name.replace('{', '').replace('}', '');

    return map[name] || '';
  }), { pascalCase: options.pascalCase });

};

module.exports = {
  isFieldArray,
  isFieldRequired,
  sanitizeField,
  generateName
};