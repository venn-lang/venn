# The cold-start twin of `fib.vn`, run as its own process by Python.
import sys


def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)


sys.setrecursionlimit(10_000)
print(fib(25))
