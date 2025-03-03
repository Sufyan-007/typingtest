interface BaseAST {
  type: string;
  id: string;
}

interface BaseReact extends BaseAST {
  type:
    | "REACT_COMPONENT"
    | "REACT_CUSTOM_HOOK"
    | "REACT_USE_MEMO"
    | "REACT_USE_EFFECT"
    | "REACT_USE_STATE"
    | "REACT_USE_REF"
    | "REACT_USE_CONTEXT"
    | "REACT_USE_REDUCER"
    | "REACT_USE_CALLBACK"
    | "REACT_USE_IMPERATIVE_HANDLE";
}

interface BaseValue  {
  type:
    | "SCOPE_VAR"
    | "ENTITY"
    | "STRING"
    | "FUNCTION"
    | "NUMERIC"
    | "BOOLEAN"
    | "CLASS"
    | "OBJECT"
    | "ARRAY"
    | "OPERATION"
    | "NULL"
    | "UNDEFINED"
    | "FUNCTION_CALL"
    | "CUSTOM"
    | "Element"
    | "SYMBOL"
  
  [key:string]:any
}

interface BaseStatement extends BaseAST {
  type:
    | "COMMENT"
    | "BLOCK"
    | "DECLARATION"
    | "ASSIGNMENT"
    | "IF_BLOCK"
    | "FOR_BLOCK"
    | "WHILE_BLOCK"
    | "SWITCH_BLOCK"
    | "RETURN"
    | "BREAK"
    | "CONTINUE"
    | "OPERATION"
    | "FUNCTION_CALL"
    | "FUNCTION"
    | "IMPORT"
    | "EXPORT"
    | "TRY_CATCH"
    | "THROW"
    | "DO_WHILE_BLOCK"
    | "CLASS"
    | "Element"
    | "CUSTOM";
}

type NamedEntities = { name: string };

type Scope = Record<NamedEntities["name"], BaseAST["id"]>;

interface Block extends BaseStatement {
  type: "BLOCK";
  scope: Scope;
  parentScope: Scope;
  statements: BaseStatement[];
  noWrap?: boolean;
}

interface BaseFunction extends BaseAST {
  type: "FUNCTION";
  schema: FunctionSchema;
  bodyConfig: Block;
}

interface Schema {}

interface Params {
  name: string;
  type: BaseValue["type"];
  id: string;
  isRest?: boolean;
  defaultValue?: BaseValue;
  isDestructured?: boolean;
}

interface FunctionSchema extends Schema {
  parameters: Params[];
  returnType: Schema;
}
interface NamedFunction extends BaseFunction, BaseStatement {
  type: "FUNCTION";
  name: string;
}

interface Declaration extends BaseStatement {
  type: "DECLARATION";
  declarationType: "const" | "let" | "var";
  varName: string;
  destructured?: boolean;
  destructureType?: "OBJECT" | "ARRAY";
  value?: BaseValue; // required in case of const
}

interface Assignment extends BaseStatement {
  type: "ASSIGNMENT";
  $ref: string;
  value: BaseValue;
}

interface BaseFunctionCall extends BaseStatement, BaseValue {
  type: "FUNCTION_CALL";
  isAwaited?: boolean;
  parameters: BaseValue[];
}
type BuiltInFunctionCall = BaseFunctionCall & { functionName: string };
type CustomFunctionCall = BaseFunctionCall & { $ref: string };

interface Custom extends BaseValue, BaseStatement {
  type: "CUSTOM";
  body: string;
}

interface IfBlock extends BaseStatement {
  type: "IF_BLOCK";
  condition: BaseValue;
  bodyConfig: Block;
  elseIf?: Array<{
    conditon: BaseValue;
    bodyConfig: Block;
  }>;
  elseBody?: Block;
}
