// var traverse = require("babel-core").traverse;

module.exports = function (ast, traverse) {
  ast.sourceType = "module";
  ast.range = [ast.start, ast.end];
  traverse(ast, astTransformVisitor);
};

var astTransformVisitor = {
  noScope: true,
  enter: function (path) {
    var node = path.node;
    node.range = [node.start, node.end];

    // private var to track original node type
    node._babelType = node.type;

    if (node.innerComments) {
      node.trailingComments = node.innerComments;
      delete node.innerComments;
    }

    if (node.trailingComments) {
      for (var i = 0; i < node.trailingComments.length; i++) {
        var comment = node.trailingComments[i];
        if (comment.type === 'CommentLine') {
          comment.type = 'Line';
        } else if (comment.type === 'CommentBlock') {
          comment.type = 'Block';
        }
        comment.range = [comment.start, comment.end];
      }
    }

    if (node.leadingComments) {
      for (var i = 0; i < node.leadingComments.length; i++) {
        var comment = node.leadingComments[i];
        if (comment.type === 'CommentLine') {
          comment.type = 'Line';
        } else if (comment.type === 'CommentBlock') {
          comment.type = 'Block';
        }
        comment.range = [comment.start, comment.end];
      }
    }

    // make '_paths' non-enumerable (babel-eslint #200)
    Object.defineProperty(node, "_paths", { value: node._paths, writable: true });
  },
  exit: function (path) {
    var node = path.node;

    if (path.isJSXText()) {
      node.type = 'Literal';
      node.raw = node.value;
    }

    if (path.isNumericLiteral() ||
        path.isStringLiteral()) {
      node.type = 'Literal';
      if (!node.raw) {
        node.raw = node.extra && node.extra.raw;
      }
    }

    if (path.isBooleanLiteral()) {
      node.type = 'Literal';
      node.raw = String(node.value);
    }

    if (path.isNullLiteral()) {
      node.type = 'Literal';
      node.raw = 'null';
      node.value = null;
    }

    if (path.isRegExpLiteral()) {
      node.type = 'Literal';
      node.raw = node.extra.raw;
      node.value = new RegExp(node.raw);
      node.regex = {
        pattern: node.pattern,
        flags: node.flags
      };
      delete node.extra;
      delete node.pattern;
      delete node.flags;
    }

    if (path.isObjectProperty()) {
      node.type = 'Property';
      node.kind = 'init';
    }

    if (path.isClassMethod() || path.isObjectMethod()) {
      node.value = {
          type: 'FunctionExpression',
          id: node.id,
          params: node.params,
          body: node.body,
          async: node.async,
          generator: node.generator,
          expression: node.expression,
          loc: {
            start: {
              line: node.key.loc.start.line,
              column: node.key.loc.end.column // a[() {]
            },
            end: node.body.loc.end
          }
      }

      // [asdf]() {
      node.value.range = [node.key.range[1], node.body.range[1]];

      if (node.returnType) {
        node.value.returnType = node.returnType;
      }

      if (node.typeParameters) {
        node.value.typeParameters = node.typeParameters;
      }

      if (path.isClassMethod()) {
        node.type = 'MethodDefinition';
      }

      if (path.isObjectMethod()) {
        node.type = 'Property';
        node.kind = 'init';
      }

      delete node.body;
      delete node.id;
      delete node.async;
      delete node.generator;
      delete node.expression;
      delete node.params;
      delete node.returnType;
      delete node.typeParameters;
    }

    if (path.isRestProperty() || path.isSpreadProperty()) {
      node.type = "SpreadProperty";
      node.key = node.value = node.argument;
    }

    // flow: prevent "no-undef"
    // for "Component" in: "let x: React.Component"
    if (path.isQualifiedTypeIdentifier()) {
      delete node.id;
    }
    // for "b" in: "var a: { b: Foo }"
    if (path.isObjectTypeProperty()) {
      delete node.key;
    }
    // for "indexer" in: "var a: {[indexer: string]: number}"
    if (path.isObjectTypeIndexer()) {
      delete node.id;
    }
    // for "param" in: "var a: { func(param: Foo): Bar };"
    if (path.isFunctionTypeParam()) {
      delete node.name;
    }

    // modules

    if (path.isImportDeclaration()) {
      delete node.isType;
    }

    if (path.isExportDeclaration()) {
      var declar = path.get("declaration");
      if (declar.isClassExpression()) {
        node.declaration.type = "ClassDeclaration";
      } else if (declar.isFunctionExpression()) {
        node.declaration.type = "FunctionDeclaration";
      }
    }

    // remove class property keys (or patch in escope)
    if (path.isClassProperty()) {
      delete node.key;
    }

    // async function as generator
    if (path.isFunction()) {
      if (node.async) node.generator = true;
    }

    // await transform to yield
    if (path.isAwaitExpression()) {
      node.type = "YieldExpression";
      node.delegate = node.all;
      delete node.all;
    }

    // template string range fixes
    if (path.isTemplateLiteral()) {
      node.quasis.forEach(function (q) {
        q.range[0] -= 1;
        if (q.tail) {
          q.range[1] += 1;
        } else {
          q.range[1] += 2;
        }
        q.loc.start.column -= 1;
        if (q.tail) {
          q.loc.end.column += 1;
        } else {
          q.loc.end.column += 2;
        }
      });
    }
  }
};
