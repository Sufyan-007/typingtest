import { Node, Project, Type } from "ts-morph";
import fs from "fs";
import { BreezeSchema } from "./BREEZE_SchemaTyping";

const project = new Project();
const conf: Record<string, BreezeSchema.SchemaModals> = {};
const source = project.addSourceFileAtPath("source.ts");

source.getInterfaces().forEach((i) => {
  const name = i.getName();
  const properties = processObjectProperties(i.getType());

  conf[name] = { ...properties, schemaType: "modals", id: name, name };
});

function processType(
  type: Type | undefined
): BreezeSchema.BaseType | BreezeSchema.Type | BreezeSchema.ReferencedType {
  // console.log(type.getSymbol().getName())
  if (!type) {
    return {
      type: "ANY",
      case: "UNDEFINED TYPE",
    };
  }

  const base = checkBaseTypes(type);
  if (base) {
    return base;
  } else if (type.getCallSignatures().length > 0) {
    return processFunction(type);
  }
  //KEEP IT AT THE END
  else if (type.isObject() && !type.isArray()) {
    const name = type.getSymbol()?.getName();
    if (name && name != "__type") {
      console.log(name);
      // const typeName = symbol.getName();
      const typeArguments = type.getTypeArguments(); // Get the template inputs

      return {
        $ref: name,
        templateInputs: typeArguments.map((t) => processType(t)), // Process the template inputs
      };
    }

    return processObjectProperties(type);
  } else if (type.isTypeParameter()) {
    return {
      $ref: type.getText(),
      refType: "TEMPLATE",
    };
  } else if (type.isTemplateLiteral()) {
    return {
      type: "STRING",
    };
  } else {
    // throw Error("HERE"+ type.getText()+type.isObject());
    return { type: "UNKNOWN_TYPE", raw: type.getText() };
  }
}

function checkBaseTypes(
  type: Type
):
  | BreezeSchema.BaseType
  | BreezeSchema.Type
  | BreezeSchema.ReferencedType
  | false {
  const literalType = getLiteralType(type);

  if (literalType) {
    return literalType;
  } else if (type.isNumber()) {
    return { type: "NUMERIC" };
  } else if (type.isString()) {
    return { type: "STRING" };
  } else if (type.isBoolean()) {
    return { type: "BOOLEAN" };
  } else if (type.isArray()) {
    return {
      type: "ARRAY",
      templateInput: processType(type.getArrayElementType()),
    };
  } else if (type.isUnion()) {
    return {
      selection: "anyOf",
      types: type.getUnionTypes().map((t) => processType(t)),
    };
  } else if (type.isIntersection()) {
    return {
      selection: "anyOf",
      types: type.getIntersectionTypes().map((t) => processType(t)),
    };
  } else if (type.isAny()) {
    return { type: "ANY" };
  } else if (type.isUnknown()) {
    return { type: "ANY" };
  } else if (type.isVoid()) {
    return { type: "VOID" };
  } else if (type.isNever()) {
    return { type: "ANY" };
  } else if (type.isUndefined()) {
    return { type: "UNDEFINED" };
  } else if (type.isNull()) {
    return { type: "NULL" };
  }
  return false;
}

function getLiteralType(type: Type): BreezeSchema.LITERAL | false {
  if (type.isLiteral()) {
    const value = type.getLiteralValue();

    // Exclude `undefined`
    if (value === undefined) return false;

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

function getBaseValueType(value: unknown) {
  if (typeof value === "string") return "STRING";
  if (typeof value === "number") return "NUMERIC";
  if (typeof value === "boolean") return "BOOLEAN";
  if (typeof value === "symbol") return "SYMBOL";

  throw new Error(`Unsupported literal type: ${typeof value}`);
}

function processObjectProperties(obj: Type): BreezeSchema.ObjectType {
  const properties: BreezeSchema.ObjectType["properties"] = {};
  const symbol = obj.getSymbol();
  const declaration = symbol?.getDeclarations()[0];
  if (declaration && Node.isInterfaceDeclaration(declaration)) {
    [...declaration.getProperties(), ...declaration.getMethods()].forEach(
      (prop) => {
        const propType = prop.getType();
        const property = processType(propType);
        const name = prop.getName();
        properties[name] = { ...property, name, id: name };
      }
    );
  } else {
    obj.getProperties().forEach((prop) => {
      const propType = prop.getTypeAtLocation(prop.getDeclarations()[0]);
      const property = processType(propType);
      const name = prop.getName();
      properties[name] = { ...property, name, id: name };
    });
  }
  return {
    type: "OBJECT",
    properties: properties,
    id: undefined,
  };
}

function processFunction(func: Type): BreezeSchema.FunctionType {
  const signature = func.getCallSignatures()[0];
  let returnType:
    | BreezeSchema.Type
    | BreezeSchema.BaseType
    | BreezeSchema.ReferencedType;
  returnType = processType(signature.getReturnType());
  if ("type" in returnType || "$ref" in returnType) {
    returnType = {
      selection: "anyOf",
      types: [returnType],
    };
  }

  // console.log(signature.getReturnType().isTypeParameter())

  const parameters: BreezeSchema.FunctionType["parameters"] = [];

  return {
    type: "FUNCTION",
    returnType: returnType,
    parameters: parameters,
    isAsync: false,
  };
}

console.log(conf);
fs.writeFileSync(
  "source.json",
  JSON.stringify(conf, (k, s) => (s === undefined ? null : s), 2)
);
