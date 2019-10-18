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

module.exports = {
  isFieldArray,
  isFieldRequired,
  sanitizeField
};