/**
 * @typedef SeqGraphQLAttribute
 * @property {Array<string>} create - Array of attribute names
 * @property {Array<string>} update - Array of attribute names
 * @property {Array<string>} fetch - Array of attribute names
 */

/**
 * @typedef SeqGraphQLAttributes
 * @property {SeqGraphQLAttribute|Array<string>} only - Array of attributes names that must be used excluding the others for the entire model or for specific type of query
 * @property {SeqGraphQLAttribute|Array<string>} exclude - Array of attributes names that must be excluded for the entire model or for specific type of query
 * @property {Object<string>} include - include some custom attributes for all query
 */

/**
 * @typedef SeqGraphQL
 * @property {SeqGraphQLAttributes} attributes - Model attributes in exclude will be excluded from graphql types. Use only array to inclusive filtering attributes instead of excluding. Non-Model custom attributes will be added in graphql type from include. You can also set exclude/only directly to entire model.
 * @property {Array<string>} bulk - Create mutations for bulk create or destroy operations. Example: ['create', 'destroy']
 * @property {Object} alias - Rename default queries and mutations with alias. Example: { count:'myCountQuery', fetch: 'myQuery', create: 'myCreateMutation', destroy: 'myDeleteMutation, update: 'myUpdateMutation' }
 * @property {Array<string>} excludeQueries - Exclude default queries. Example: [ 'count', 'fetch' ]
 * @property {Array<string>} excludeMutations - Exclude default mutations. Example: [ 'create', 'update', 'destroy' ]
 * @property {Array<string>} excludeSubscriptions - Exclude default subscriptions. Example: [ 'create', 'update', 'destroy' ]
 * @property {Object} types - Create custom types. Add Input postfix to convert to input type. Example: {myType: { id: '[int]' }, myTypeInput: { id: 'int' }}
 * @property {Object} mutations - Custom mutations to be created. input or output can refer to a custom input type or default graphql types. Example: {myMutation: { input: 'myTypeInput', output: '[myType]', resolver: customResolver}}
 * @property {Object} queries - Custom queries to be created. input or output can refer to a custom input type or default graphql types. {myQuery: { output: '[myType]', resolver: customResolver }}
 * @property {Object} subscriptions - Custom subscriptions to be created. input or output can refer to a custom input type or default graphql types. {mySub: { output: '[myType]', resolver: customResolver, subscriber: customSubscriber }}
 * @property {Object} subsFilter - To run before subscription executes. Available options are default, create, fetch, destroy and update. Functions must return a promise or boolean. Example: {create: (payload, variables, context, info) => { return Promise.resolve(); }}
 * @property {Object} before - To run before default query or mutation executes. Available options are create, fetch, destroy and update. Functions must return a promise. Example: {create: (source, args, context, info) => { return Promise.resolve(); }}
 * @property {Object} overwrite - This will overwrite default query or mutation.
 * @property {Object} extend - To extend default functionality. Example: Available options are create, fetch, destroy and update. Same as "before" with data coming from default passed to this function: create: (data, source, args, context, info, where)
 * @property {Array} import - Associations with remote schema.
 *
 */
