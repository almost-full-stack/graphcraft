
function formatGraphQLError(error) {
  const originalError = error.originalError || error;

  const formattedError = {
    message: error.message || 'Unexpected error occurred.',
    path: error.path,
    locations: error.locations,
    extensions: {
      code: originalError.code || 'INTERNAL_SERVER_ERROR',
      ...originalError.extensions, // any extra metadata
    },
  };

  formattedError.extensions.stacktrace = (originalError.stack || error.stack || '').
      split('\n').
      map((line) => line.trim());

  return formattedError;
}

module.exports = formatGraphQLError;