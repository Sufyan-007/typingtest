import { BreezeSchema } from "./BREEZE_SchemaTyping";

export interface A extends HelloWorld.B {}

declare global {
  export namespace HelloWorld {
    interface B {}
  }
}

export {}