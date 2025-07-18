import {
  InterfaceDeclaration,
  ModuleDeclaration,
  Node,
  Project,
  SourceFile,
  ts,
  Type,
  TypeAliasDeclaration,
  TypeFlags,
} from "ts-morph";
import * as fs from "fs";
import { BreezeSchema } from "./BREEZE_SchemaTyping";
import * as path from "path";
// import ts from "typescript";

export type Globals =  {
  variables: Record<string, BreezeSchema.Type>;
  functions: Record<string, BreezeSchema.FunctionType>;
  classes: Record<string, BreezeSchema.Type>;
}

const FilePrefix = "LIB_DOM."
const project = new Project();
const conf: Record<string, BreezeSchema.StoredSchema> & {globals?:Globals} = {};
const sourceFilePath = process.argv[2];
let outputFile = process.argv[3];

if (!sourceFilePath) {
  console.error("❌ Error: Please provide a TypeScript file as an argument.");
  console.error("Usage: npx tsx file.ts source.ts");
  process.exit(1);
}
type mySource = { meta: String };
const source = project.addSourceFileAtPath(sourceFilePath) as SourceFile &
  mySource;
if (!outputFile) {
  const inputDir = path.dirname(sourceFilePath);
  const fileName = path.basename(sourceFilePath, path.extname(sourceFilePath)); // Get the file name without extension
  outputFile = path.join(inputDir, `${fileName}.json`);
}
source.meta = "Helllo there";





source.getModules().forEach((m) => processModule(m,FilePrefix));
source.getInterfaces().forEach((i) => processInterface(i,FilePrefix));
source.getTypeAliases().forEach((t) => processTypeAlias(t,FilePrefix));


const globals = processGlobalDeclarations(source)

conf["globals"] = globals


console.log(outputFile);
fs.writeFileSync(
  outputFile,
  JSON.stringify(conf, (_, s) => (s === undefined ? null : s), 2)
);



function processGlobalDeclarations(source: SourceFile):Globals {
  const globals = {
    variables: {} as Record<string, BreezeSchema.Type>,
    functions: {} as Record<string, BreezeSchema.FunctionType>,
    classes: {} as Record<string, BreezeSchema.Type>
  };

  source.getStatements().forEach((stmt) => {
    if (Node.isVariableStatement(stmt) && stmt.hasDeclareKeyword()) {
      stmt.getDeclarations().forEach((decl) => {
        const name = decl.getName();
        const varType = decl.getType();
        globals.variables[name] = checkAndConverToUnion(processType(varType));
      });
    }
    else if (Node.isFunctionDeclaration(stmt) && stmt.hasDeclareKeyword()) {
      const name = stmt.getName();
      if (name) {
        const funcType = stmt.getType();
        globals.functions[name] = processFunction(funcType);
      }
    }

    else if (Node.isClassDeclaration(stmt) && stmt.hasDeclareKeyword()) {
      const name = stmt.getName();
      if (name) {
        const classType = stmt.getType();
        globals.classes[name] = checkAndConverToUnion(processType(classType));
      }
    }

    

  });

  return globals;
}



function extractFinalQualifiedName(str:string) {
  str = str.replace(/^"|"$/g, "");

  const quoteSplit = str.split('"');
  const afterPath = quoteSplit.length > 1 ? quoteSplit[quoteSplit.length - 1]||"" : str;

  return FilePrefix+ (afterPath.startsWith('.') ? afterPath.slice(1) : afterPath);
}





function processInterface(
  i: InterfaceDeclaration,
  idPrefix: "" | `${string}.` = ""
) {
  const name = i.getName();
  const id = idPrefix + name;
  const objectDetails = processObject(i.getType());
  const templateInputs: BreezeSchema.SchemaModals["templates"] = [];
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
    const schema = conf[id] as BreezeSchema.SchemaModals;
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
  } as BreezeSchema.SchemaModals;
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

  module.getTypeAliases().forEach((t) => processTypeAlias(t, prefix));

  module.getModules().forEach((m) => processModule(m, prefix));
}

function processTypeAlias(
  t: TypeAliasDeclaration,
  idPrefix: "" | `${string}.` = ""
) {
  const name = t.getName();

  let type: BreezeSchema.Type;

  const id = idPrefix + name;

  if (!["HeadersInit"].includes(name)) {
    type = checkAndConverToUnion(processType(t.getType(), true));
  } else {
    type = {
      selection: "anyOf",
      types: [
        {
          type: "UNKNOWN_TYPE",
        },
      ],
    };
  }

  const combinedType: BreezeSchema.CombinedType = {
    schemaType: "combined_schema",
    name: name,
    ...type,
    id: id,
  };
  conf[id] = combinedType;
}


function processType(
  type: Type,
  bypassRef: boolean = false
): BreezeSchema.BaseType | BreezeSchema.Type | BreezeSchema.ReferencedType {
  if (!type) {
    return {
      type: "ANY",
      case: "UNDEFINED TYPE",
    } as BreezeSchema.AnyType;
  }

  if (
    type.compilerType.flags & TypeFlags.Conditional ||
    type.compilerType.flags & TypeFlags.IndexedAccess
  ) {
    return {
      type: "UNKNOWN_TYPE",
      raw: "At least this came here isntead",
    } as BreezeSchema.UnknownType;
  }

  const base = checkBaseTypes(type, bypassRef);
  if (base) {
    return base;
  } else if (type.getCallSignatures().length > 0) {
    return processFunction(type);
  }

  //KEEP IT AT THE END
  else if (type.isObject() && !type.isArray()) {
    const name = type.getSymbol()?.getFullyQualifiedName();
    if (name && name != "__type") {
      // const typeName = symbol.getName();
      const typeArguments = type.getTypeArguments(); // Get the template inputs
      return {
        $ref: extractFinalQualifiedName(name),
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
  } else if (type.getAliasSymbol()) {
    const typeArguments = type.getTypeArguments();
    const name = type.getAliasSymbol()?.getFullyQualifiedName();
    const ref = name? extractFinalQualifiedName(name) : "UNKNOWN_TYPE";
    return {
      $ref: ref,
      templateInputs: typeArguments.map((t) => processType(t)),
    };
  } else {
    // throw Error("HERE"+ type.getText()+type.isObject());
    console.log(
      type.getAliasSymbol(),
      type.getUnionTypes(),
      type.getText(),
      type.compilerType.flags
    );
    const obj: BreezeSchema.UnknownType = {
      type: "UNKNOWN_TYPE",
      raw: type.getText() + "THe heck is this",
    };
    return obj;
  }
}

function checkBaseTypes(
  type: Type,
  bypassRef: boolean = false
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
  } else if (
    type.getFlags() & ts.TypeFlags.UniqueESSymbol ||
    type.getFlags() & ts.TypeFlags.ESSymbol
  ) {
    return { type: "SYMBOL" }; // Correctly detect 'symbol'
  } else if (type.isArray()) {
    const itemType = type.getArrayElementTypeOrThrow();
    return {
      type: "ARRAY",
      templateInputs: [processType(itemType)],
    };
  } else if (type.isUnion()) {
    const alias = extractFinalQualifiedName(type.getAliasSymbol()?.getFullyQualifiedName()||"");
    if (alias && !bypassRef) {
      return {
        $ref: alias,
      };
    }
    return {
      selection: "anyOf",
      types: type.getUnionTypes().map((t) => processType(t)),
    };
  } else if (type.isIntersection()) {
    const alias = type.getAliasSymbol()?.getFullyQualifiedName();
    if (alias && !bypassRef) {
      return {
        $ref: extractFinalQualifiedName(alias),
      };
    }
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
  } else if (type.isBigInt()) {
    return { type: "NUMERIC" };
  } else if (type.isUndefined()) {
    return { type: "UNDEFINED" };
  } else if (type.isNull()) {
    return { type: "NULL" };
  }
  return false;
}

function getLiteralType(type: Type): BreezeSchema.LITERAL | false {
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

function checkAndConverToUnion(
  t: BreezeSchema.BaseType | BreezeSchema.Type | BreezeSchema.ReferencedType
): BreezeSchema.Type {
  if ("types" in t) {
    return t;
  }
  return {
    selection: "anyOf",
    types: [t],
  };
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
        const name = prop.getName();
        if (!["tee", "view"].includes(name)) {
          const property = checkAndConverToUnion(processType(propType));
          if (prop.getSymbol()?.isOptional() === false) {
            required.push(name);
          }

          properties[name] = { ...property, name, id: name };
        } else {
          properties[name] = {
            types: [{ type: "UNKNOWN_TYPE" }],
            selection: "anyOf",
            name,
            id: name,
          };
        }
      }
    );
  } else {
    obj.getProperties().forEach((prop) => {
      const declaration = prop.getDeclarations()[0];
      if (!declaration) {
        console.log(prop.getName(), obj.getText());
        throw Error("Object declaration not found");
      }
      const name = prop.getName();

      if (!["tee"].includes(name)) {
        const propType = prop.getTypeAtLocation(declaration);
        const property = checkAndConverToUnion(processType(propType));
        if (!prop.isOptional()) {
          required.push(name);
        }
        properties[name] = { ...property, name, id: name };
      } else {
        properties[name] = {
          types: [{ type: "UNKNOWN_TYPE" }],
          selection: "anyOf",
          name,
          id: name,
        };
      }
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

// const baseSource = project.createSourceFile("sorucesss.ts", "console.log()");

// const base: string[] = [];
// baseSource
//   .getChildren()
//   .forEach((c) =>
//     c.getSymbolsInScope(-1).forEach((m) => base.push(m.getName()))
//   );
// source.getChildren().forEach((c) => {
//   c.getSymbolsInScope(-1).forEach((s) => {
//     if (!base.includes(s.getName())) {
//       console.log(s.getEscapedName());
//     }
//   });
// });
