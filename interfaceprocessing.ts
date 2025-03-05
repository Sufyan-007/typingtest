import {
  InterfaceDeclaration,
  ModuleDeclaration,
  Node,
  Project,
  Type,
  TypeAliasDeclaration,
} from "ts-morph";
import * as fs from "fs";
import { BreezeSchema } from "./BREEZE_SchemaTyping";
import * as path from "path";

const project = new Project();
const conf: Record<
  string,
  BreezeSchema.SchemaModals | BreezeSchema.CombinedType
> = {};
const sourceFilePath = process.argv[2];
let outputFile = process.argv[3];

if (!sourceFilePath) {
  console.error("❌ Error: Please provide a TypeScript file as an argument.");
  console.error("Usage: npx tsx file.ts source.ts");
  process.exit(1);
}
const source = project.addSourceFileAtPath(sourceFilePath);
if (!outputFile) {
  const inputDir = path.dirname(sourceFilePath);
  const fileName = path.basename(sourceFilePath, path.extname(sourceFilePath)); // Get the file name without extension
  outputFile = path.join(inputDir, `${fileName}.json`);
}

function processInterface(
  i: InterfaceDeclaration,
  idPrefix: "" | `${string}.` = ""
) {
  const name = i.getName();
  const id = idPrefix + name;
  const objectDetails = processObject(i.getType());
  const templateInputs: BreezeSchema.SchemaModals["templateInputs"] = [];
  i.getTypeParameters().forEach((template) => {
    const symbol = template.getSymbol();
    const name = symbol?.getName() || "Unknown";
    const constraints = template.getType().getConstraint();
    templateInputs.push({
      ...(constraints && { extends: processType(constraints) }),
      name,
    });
  });
  const extending: BreezeSchema.SchemaModals["extends"] = [];

  i.getExtends().forEach((e) => {
    // extends will always be refrenced type
    const parent = processType(e.getType()) as BreezeSchema.ReferencedType;
    extending.push(parent);
  });

  if (conf[id]?.schemaType === "modals") {
    console.warn(`Merging duplicate schema for: ${id}`);
    const schema = conf[id];
    // Merge properties
    schema.properties = {
      ...schema.properties,
      ...objectDetails.properties, // Merge properties from new interface
    };
    // Merge extends (avoid duplicates)
    schema.extends = [
      ...(schema.extends || []),
      ...extending.filter(
        (ext) => !schema.extends?.some((existing) => existing.$ref === ext.$ref)
      ),
    ];

    return;
  }

  conf[id] = {
    ...objectDetails,
    templateInputs,
    schemaType: "modals",
    id: id,
    name,
    extends: extending,
  };
}

function processModule(
  module: ModuleDeclaration,
  idPrefix: `${string}.` | undefined = undefined
) {
  let prefix: `${string}.`;
  if (idPrefix) {
    prefix = `${idPrefix}${module.getName()}.`;
  } else {
    prefix = `${module.getName()}.`;
  }
  module.getInterfaces().forEach((i) => processInterface(i, prefix));
  module.getModules().forEach((m) => processModule(m, prefix));
}

function processTypeAlias(
  t: TypeAliasDeclaration,
  idPrefix: "" | `${string}.` = ""
) {
  const name = t.getName();
  const id = idPrefix + name;
  console.log(name);
}

source.getModules().forEach((m) => processModule(m));
source.getInterfaces().forEach((i) => processInterface(i));
source.getTypeAliases().forEach((t) => processTypeAlias(t));

function processType(
  type: Type
): BreezeSchema.BaseType | BreezeSchema.Type | BreezeSchema.ReferencedType {
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
      // const typeName = symbol.getName();
      const typeArguments = type.getTypeArguments(); // Get the template inputs
      return {
        $ref: name,
        templateInputs: typeArguments.map((t) => {
          const type = processType(t); // Process the template inputs
          return type;
        }),
      };
    }

    return processObject(type);
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
    const itemType = type.getArrayElementTypeOrThrow();
    return {
      type: "ARRAY",
      templateInput: [processType(itemType)],
    };
  } else if (type.isUnion()) {
    const alias = type.getAliasSymbol()?.getFullyQualifiedName();
    if (alias) {
      return {
        $ref: alias,
      };
    }
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

function processObject(obj: Type): BreezeSchema.ObjectType {
  const properties: BreezeSchema.ObjectType["properties"] = {};
  const symbol = obj.getSymbol();
  const declaration = symbol?.getDeclarations()[0];
  const required: string[] = [];
  if (declaration && Node.isInterfaceDeclaration(declaration)) {
    [...declaration.getProperties(), ...declaration.getMethods()].forEach(
      (prop) => {
        const propType = prop.getType();
        const property = processType(propType);
        const name = prop.getName();
        if (prop.getSymbol()?.isOptional() === false) {
          required.push(name);
        }

        properties[name] = { ...property, name, id: name };
      }
    );
  } else {
    obj.getProperties().forEach((prop) => {
      const declaration = prop.getDeclarations()[0];
      if (!declaration) {
        throw Error("Object declaration not found");
      }
      const propType = prop.getTypeAtLocation(declaration);
      const property = processType(propType);
      const name = prop.getName();
      if (!prop.isOptional()) {
        required.push(name);
      }
      properties[name] = { ...property, name, id: name };
    });
  }
  return {
    type: "OBJECT",
    properties: properties,
    required: required,
  };
}

function processFunction(func: Type): BreezeSchema.FunctionType {
  const signature = func.getCallSignatures()[0];
  if (!signature) {
    throw Error("The given object is not a function");
  }
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

  const templates: BreezeSchema.FunctionType["templateInputs"] = [];

  const parameters: BreezeSchema.FunctionType["parameters"] = [];

  signature.getTypeParameters().forEach((template) => {
    const symbol = template.getSymbol();
    const name = symbol?.getName() || "Unknown";
    const constrain = template.getConstraint();
    templates.push({
      ...(constrain && { extends: processType(constrain) }),
      name,
    });
  });

  return {
    type: "FUNCTION",
    returnType: returnType,
    parameters: parameters,
    isAsync: false,
  };
}
fs.writeFileSync(
  outputFile,
  JSON.stringify(conf, (_, s) => (s === undefined ? null : s), 2)
);
