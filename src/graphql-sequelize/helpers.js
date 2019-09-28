function nodeAST(connectionAST) {
  return connectionAST.fields.edges &&
    connectionAST.fields.edges.fields.node;
}

function nodeType(connectionType) {
  return connectionType._fields.edges.type.ofType._fields.node.type;
}

module.exports = {
    nodeAST,
    nodeType
}