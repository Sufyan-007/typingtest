import {Project, SourceFile} from "ts-morph";


const project = new Project()
const source = project.addSourceFileAtPath("source.ts")
console.log(source.getChildren()[0].getKindName())


