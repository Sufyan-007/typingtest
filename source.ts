interface A extends String {
  obj: <x extends A>(a: x) => x;
}
