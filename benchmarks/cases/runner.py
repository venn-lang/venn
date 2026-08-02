"""Time the Python twins the same way the JavaScript harness times its own.

Warmup, then repetitions, reported as the median, and every result is kept, so
nothing measured here can be optimised away as dead.

    python cases/runner.py
"""

import json
import sys
import time

from twins import CASES

REPS = 9
WARMUP = 6

sink = None


def measure(run):
    global sink
    for _ in range(WARMUP):
        sink = run()
    samples = []
    for _ in range(REPS):
        started = time.perf_counter_ns()
        sink = run()
        samples.append((time.perf_counter_ns() - started) / 1e6)
    samples.sort()
    return samples[len(samples) // 2]


def main():
    # Deep enough for fib(25), which Python's default limit will not reach.
    sys.setrecursionlimit(10_000)
    results = {name: measure(run) for name, run in CASES}
    print(json.dumps(results))


if __name__ == "__main__":
    main()
