import { BaseType } from "ts-json-schema-generator";

export namespace BreezeSchema {
  export interface BaseType {
    type:
      | "STRING"
      | "NUMERIC"
      | "LABEL"
      | "SYMBOL"
      | "BOOLEAN"
      | "OBJECT"
      | "ARRAY"
      | "LITERAL"
      | "FUNCTION"
      | "VOID"
      | "UNDEFINED"
      | "ANY"
      | "UNKNOWN_TYPE"
      | "NULL";
    [key:string]:any
  }
  export interface LITERAL extends BaseType{
    type:"LITERAL",
    value:BaseValue
  }

  export interface Label extends BaseType {
    type: "LABEL";
    value: string | number | boolean | symbol;
  }

  export interface FunctionType extends BaseType {
    type: "FUNCTION";
    returnType: Type;
    isAsync: boolean;
    parameters: Array<Type>;
  }

  export type Properties =   {
    id: string;
    name: string;
    description?: string;
    exampleValue?: any;
    defaultValue?: any;
  }&(BaseType|Type|ReferencedType)

  export interface ObjectType extends BaseType {
    type: "OBJECT";
    id?: string;
    properties: Record<Properties["id"], Properties>;
    templateInputs?: Array<{
      name: string;
      extends?: Type;
    }>;
    extends?: ReferencedType[];
    required?: Properties["id"][];
    additionalProperties?: Type;
  }

  export interface StoredSchema {
    name: string;
    description?: string;
    exampleValue?: any;
  }

  export interface SchemaModals extends ObjectType, StoredSchema {
    schemaType: "modals";
  }

  export interface CombinedType extends Type, StoredSchema {
    schemaType: "combined";
  }

  export interface ReferencedType {
    $ref: ObjectType["id"];
    templateInputs?: Array<Type|BaseType|ReferencedType>;
  }

  export interface Type {
    selection: "anyOf" | "oneOf" | "allOf";
    // At least one element Must be in the array
    types: Array<BaseType | ReferencedType| Type>;
  }

  export interface Test{
    hello:"World"
  }
}


