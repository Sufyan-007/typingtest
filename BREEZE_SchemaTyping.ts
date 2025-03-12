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
    // [key:string]:any
  }
  export interface ArrayType extends BaseType{
    templateInputs:[
      ReferencedType
    ]
  }
  export interface UnknownType {
    type: "UNKNOWN_TYPE";
    [key:string]: any;
  }

  export interface LITERAL extends BaseType {
    type: "LITERAL";
    value: BaseValue;
  }
  export interface AnyType extends BaseType{
    type:"ANY",
    [key:string]:any
  }

  export interface Label extends BaseType {
    type: "LABEL";
    value: string | number | boolean | symbol;
  }

  export interface FunctionType extends BaseType {
    type: "FUNCTION";
    returnType: Type;
    isAsync: boolean;
    templateInputs?: Array<{
      name: string;
      extends?: Type | BaseType | ReferencedType;
    }>;
    parameters: Array<Type>;
  }

  export type Properties = {
    id: string;
    name: string;
    description?: string;
    exampleValue?: any;
    defaultValue?: any;
  } & (Type  );

  export interface ObjectType extends BaseType {
    type: "OBJECT";
    id?: string;
    properties: Record<Properties["id"], Properties>;
    templateInputs?: Array<{
      name: string;
      extends?: Type | BaseType | ReferencedType;
    }>;
    required?: Properties["id"][];
    additionalProperties?: Type;
  }

  export interface StoredSchema {
    name: string;
    id:string
    schemaType:"modals"|"combined_schema"
    description?: string;
    exampleValue?: any;
  }

  export interface SchemaModals extends ObjectType, StoredSchema {
    id:string
    extends?: Array<ReferencedType>;
    schemaType: "modals";
  }

  export interface CombinedType extends Type, StoredSchema {
    schemaType: "combined_schema";
  }

  export interface ReferencedType {
    $ref: ObjectType["id"];
    templateInputs?: Array<Type | BaseType | ReferencedType>;
    refType?: string;
  }

  export interface Type {
    selection: "anyOf" | "oneOf" | "allOf" |"conditional";
    // At least one element Must be in the array
    types: Array<BaseType | ReferencedType | Type>;
  }

}
