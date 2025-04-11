"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts_morph_1 = require("ts-morph");
var fs = require("fs");
var path = require("path");
// import ts from "typescript";
var project = new ts_morph_1.Project();
var conf = {};
var sourceFilePath = process.argv[2];
var outputFile = process.argv[3];
if (!sourceFilePath) {
    console.error("❌ Error: Please provide a TypeScript file as an argument.");
    console.error("Usage: npx tsx file.ts source.ts");
    process.exit(1);
}
var source = project.addSourceFileAtPath(sourceFilePath);
if (!outputFile) {
    var inputDir = path.dirname(sourceFilePath);
    var fileName = path.basename(sourceFilePath, path.extname(sourceFilePath)); // Get the file name without extension
    outputFile = path.join(inputDir, "".concat(fileName, ".json"));
}
source.meta = "Helllo there";
function processInterface(i, idPrefix) {
    var _a;
    if (idPrefix === void 0) { idPrefix = ""; }
    var name = i.getName();
    var id = idPrefix + name;
    var objectDetails = processObject(i.getType());
    var templateInputs = [];
    i.getTypeParameters().forEach(function (template) {
        var symbol = template.getSymbol();
        var name = (symbol === null || symbol === void 0 ? void 0 : symbol.getName()) || "Unknown";
        var constraints = template.getType().getConstraint();
        templateInputs.push(__assign(__assign({}, (constraints && { extends: processType(constraints) })), { name: name }));
    });
    var extending = [];
    i.getExtends().forEach(function (e) {
        // extends will always be refrenced type
        var parent = processType(e.getType());
        extending.push(parent);
    });
    if (((_a = conf[id]) === null || _a === void 0 ? void 0 : _a.schemaType) === "modals") {
        console.warn("Merging duplicate schema for: ".concat(id));
        var schema_1 = conf[id];
        // Merge properties
        schema_1.properties = __assign(__assign({}, schema_1.properties), objectDetails.properties);
        // Merge extends (avoid duplicates)
        schema_1.extends = __spreadArray(__spreadArray([], (schema_1.extends || []), true), extending.filter(function (ext) { var _a; return !((_a = schema_1.extends) === null || _a === void 0 ? void 0 : _a.some(function (existing) { return existing.$ref === ext.$ref; })); }), true);
        return;
    }
    conf[id] = __assign(__assign({}, objectDetails), { templateInputs: templateInputs, schemaType: "modals", id: id, name: name, extends: extending });
}
function processModule(module, idPrefix) {
    if (idPrefix === void 0) { idPrefix = undefined; }
    var prefix;
    if (idPrefix) {
        prefix = "".concat(idPrefix).concat(module.getName(), ".");
    }
    else {
        prefix = "".concat(module.getName(), ".");
    }
    module.getInterfaces().forEach(function (i) { return processInterface(i, prefix); });
    module.getTypeAliases().forEach(function (t) { return processTypeAlias(t, prefix); });
    module.getModules().forEach(function (m) { return processModule(m, prefix); });
}
function processTypeAlias(t, idPrefix) {
    if (idPrefix === void 0) { idPrefix = ""; }
    var name = t.getName();
    var id = idPrefix + name;
    var type = checkAndConverToUnion(processType(t.getType(), true));
    var combinedType = __assign(__assign({ schemaType: "combined_schema", name: name }, type), { id: id });
    conf[id] = combinedType;
}
// source.getModules().forEach((m) => processModule(m));
// source.getInterfaces().forEach((i) => processInterface(i));
// source.getTypeAliases().forEach((t) => processTypeAlias(t));
function processType(type, bypassRef) {
    var _a, _b;
    if (bypassRef === void 0) { bypassRef = false; }
    if (!type) {
        return {
            type: "ANY",
            case: "UNDEFINED TYPE",
        };
    }
    if (type.compilerType.flags & ts_morph_1.TypeFlags.Conditional ||
        type.compilerType.flags & ts_morph_1.TypeFlags.IndexedAccess) {
        return {
            type: "UNKNOWN_TYPE",
            raw: "At least this came here isntead",
        };
    }
    var base = checkBaseTypes(type, bypassRef);
    if (base) {
        return base;
    }
    else if (type.getCallSignatures().length > 0) {
        return processFunction(type);
    }
    //KEEP IT AT THE END
    else if (type.isObject() && !type.isArray()) {
        var name_1 = (_a = type.getSymbol()) === null || _a === void 0 ? void 0 : _a.getName();
        if (name_1 && name_1 != "__type") {
            // const typeName = symbol.getName();
            var typeArguments = type.getTypeArguments(); // Get the template inputs
            return {
                $ref: name_1,
                templateInputs: typeArguments.map(function (t) {
                    var type = processType(t); // Process the template inputs
                    return type;
                }),
            };
        }
        return processObject(type);
    }
    else if (type.isTypeParameter()) {
        return {
            $ref: type.getText(),
            refType: "TEMPLATE",
        };
    }
    else if (type.isTemplateLiteral()) {
        return {
            type: "STRING",
        };
    }
    else if (type.getAliasSymbol()) {
        var typeArguments = type.getTypeArguments();
        return {
            $ref: (_b = type.getAliasSymbol()) === null || _b === void 0 ? void 0 : _b.getName(),
            templateInputs: typeArguments.map(function (t) { return processType(t); }),
        };
    }
    else {
        // throw Error("HERE"+ type.getText()+type.isObject());
        console.log(type.getAliasSymbol(), type.getUnionTypes(), type.getText(), type.compilerType.flags);
        var obj = {
            type: "UNKNOWN_TYPE",
            raw: type.getText() + "THe heck is this",
        };
        return obj;
    }
}
function checkBaseTypes(type, bypassRef) {
    var _a, _b;
    if (bypassRef === void 0) { bypassRef = false; }
    var literalType = getLiteralType(type);
    if (literalType) {
        return literalType;
    }
    else if (type.isNumber()) {
        return { type: "NUMERIC" };
    }
    else if (type.isString()) {
        return { type: "STRING" };
    }
    else if (type.isBoolean()) {
        return { type: "BOOLEAN" };
    }
    else if (type.getFlags() & ts_morph_1.ts.TypeFlags.UniqueESSymbol ||
        type.getFlags() & ts_morph_1.ts.TypeFlags.ESSymbol) {
        return { type: "SYMBOL" }; // Correctly detect 'symbol'
    }
    else if (type.isArray()) {
        var itemType = type.getArrayElementTypeOrThrow();
        return {
            type: "ARRAY",
            templateInputs: [processType(itemType)],
        };
    }
    else if (type.isUnion()) {
        var alias = (_a = type.getAliasSymbol()) === null || _a === void 0 ? void 0 : _a.getName();
        if (alias && !bypassRef) {
            return {
                $ref: alias,
            };
        }
        return {
            selection: "anyOf",
            types: type.getUnionTypes().map(function (t) { return processType(t); }),
        };
    }
    else if (type.isIntersection()) {
        var alias = (_b = type.getAliasSymbol()) === null || _b === void 0 ? void 0 : _b.getName();
        if (alias && !bypassRef) {
            return {
                $ref: alias,
            };
        }
        return {
            selection: "anyOf",
            types: type.getIntersectionTypes().map(function (t) { return processType(t); }),
        };
    }
    else if (type.isAny()) {
        return { type: "ANY" };
    }
    else if (type.isUnknown()) {
        return { type: "ANY" };
    }
    else if (type.isVoid()) {
        return { type: "VOID" };
    }
    else if (type.isNever()) {
        return { type: "ANY" };
    }
    else if (type.isBigInt()) {
        return { type: "NUMERIC" };
    }
    else if (type.isUndefined()) {
        return { type: "UNDEFINED" };
    }
    else if (type.isNull()) {
        return { type: "NULL" };
    }
    return false;
}
function getLiteralType(type) {
    if (type.isBooleanLiteral()) {
        return {
            type: "LITERAL",
            value: {
                type: "BOOLEAN",
                value: type.getText() === "true", // Convert "true"/"false" string to actual boolean
            },
        };
    }
    if (type.isLiteral()) {
        var value = type.getLiteralValue();
        // Exclude `undefined`
        if (value === undefined)
            return false;
        return {
            type: "LITERAL",
            value: {
                type: getBaseValueType(value),
                value: value,
            },
        };
    }
    return false;
}
function getBaseValueType(value) {
    if (typeof value === "string")
        return "STRING";
    if (typeof value === "number")
        return "NUMERIC";
    if (typeof value === "boolean")
        return "BOOLEAN";
    if (typeof value === "symbol")
        return "SYMBOL";
    throw new Error("Unsupported literal type: ".concat(typeof value));
}
function checkAndConverToUnion(t) {
    if ("types" in t) {
        return t;
    }
    return {
        selection: "anyOf",
        types: [t],
    };
}
function processObject(obj) {
    var properties = {};
    var symbol = obj.getSymbol();
    var declaration = symbol === null || symbol === void 0 ? void 0 : symbol.getDeclarations()[0];
    var required = [];
    if (declaration && ts_morph_1.Node.isInterfaceDeclaration(declaration)) {
        __spreadArray(__spreadArray([], declaration.getProperties(), true), declaration.getMethods(), true).forEach(function (prop) {
            var _a;
            var propType = prop.getType();
            var property = checkAndConverToUnion(processType(propType));
            var name = prop.getName();
            if (((_a = prop.getSymbol()) === null || _a === void 0 ? void 0 : _a.isOptional()) === false) {
                required.push(name);
            }
            properties[name] = __assign(__assign({}, property), { name: name, id: name });
        });
    }
    else {
        obj.getProperties().forEach(function (prop) {
            var declaration = prop.getDeclarations()[0];
            if (!declaration) {
                throw Error("Object declaration not found");
            }
            var propType = prop.getTypeAtLocation(declaration);
            var property = checkAndConverToUnion(processType(propType));
            var name = prop.getName();
            if (!prop.isOptional()) {
                required.push(name);
            }
            properties[name] = __assign(__assign({}, property), { name: name, id: name });
        });
    }
    return {
        type: "OBJECT",
        properties: properties,
        required: required,
    };
}
function processFunction(func) {
    var signature = func.getCallSignatures()[0];
    if (!signature) {
        throw Error("The given object is not a function");
    }
    var returnType;
    returnType = processType(signature.getReturnType());
    if ("type" in returnType || "$ref" in returnType) {
        returnType = {
            selection: "anyOf",
            types: [returnType],
        };
    }
    var templates = [];
    var parameters = [];
    signature.getTypeParameters().forEach(function (template) {
        var symbol = template.getSymbol();
        var name = (symbol === null || symbol === void 0 ? void 0 : symbol.getName()) || "Unknown";
        var constrain = template.getConstraint();
        templates.push(__assign(__assign({}, (constrain && { extends: processType(constrain) })), { name: name }));
    });
    return {
        type: "FUNCTION",
        returnType: returnType,
        parameters: parameters,
        isAsync: false,
    };
}
console.log(outputFile);
fs.writeFileSync(outputFile, JSON.stringify(conf, function (_, s) { return (s === undefined ? null : s); }, 2));
var baseSource = project.createSourceFile("sorucesss.ts", "console.log()");
var base = [];
baseSource
    .getChildren()
    .forEach(function (c) { return c.getSymbolsInScope(-1).forEach(function (m) { return base.push(m.getName()); }); });
source.getChildren().forEach(function (c) {
    c.getSymbolsInScope(-1).forEach(function (s) {
        if (!base.includes(s.getName())) {
            console.log(s.getEscapedName());
        }
    });
});
