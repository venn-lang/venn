// The cold-start twin of `fib.vn`, run as its own process by `node`.
function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

process.stdout.write(`${fib(25)}\n`);
