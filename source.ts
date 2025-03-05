interface A{
    a:string
    v:number
}

interface B{
    a:number
    c:string
}


type X = A|B


const a:X = {
    a:123,
    c:"ssf"
}