interface A {}

interface X extends A {
  s: string;
}

interface Y<T extends A> {
  prop: T extends X ? string : number;
}

const a: Y<X> = {
  prop: "123",
};

const b: Y<A> = {
  prop: 123,
};
