import { BreezeSchema } from "./BREEZE_SchemaTyping";
import { Globals } from "./interfaceprocessing";
import { readFileSync, writeFileSync } from 'fs';

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

let globals: Globals;

const filePath = "/home/sufyan/Documents/Projects/breezeRepo/generated_projects/typingtest/lib.json"

try {
  const data = readFileSync(filePath, 'utf8');
  const json = JSON.parse(data);
  globals = json.globals;
}
catch(err){
    console.log(err)
    throw err
}


const Globals:BreezeSchema.SchemaModals = {
    id:"globalThis",
    schemaType:"modals",
    type:"OBJECT",
    name:"globalThis",
    properties:{}
}
Object.entries(globals.variables).forEach(([key,globalVar])=>{
    const type = checkAndConverToUnion(globalVar)
    const property:BreezeSchema.Properties ={
        id:key,
        name:key,
        ...type
    }
    Globals.properties[key] =property
})

Object.entries(globals.classes).forEach(([key,globalClasses])=>{
    const type = checkAndConverToUnion(globalClasses)
    const property:BreezeSchema.Properties ={
        id:key,
        name:key,
        ...type
    }
    Globals.properties[key] =property
})

Object.entries(globals.functions).forEach(([key,globalFunctions])=>{
    const type = checkAndConverToUnion(globalFunctions)
    const property:BreezeSchema.Properties ={
        id:key,
        name:key,
        ...type
    }
    Globals.properties[key] =property
})

writeFileSync(
  "globalThis.json",
  JSON.stringify(Globals, (_, s) => (s === undefined ? null : s), 2)
);
