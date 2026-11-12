import assert from "node:assert/strict";
import test from "node:test";
import { allocationCoverage } from "../src/lib/coverage.ts";

test("resource coverage aggregates split allocations and caps over-fulfillment", () => {
  assert.deepEqual(allocationCoverage([
    { request_id: "n1", quantity: 4 },
    { request_id: "n1", quantity: 7 },
    { request_id: "n2", quantity: 99 },
  ], "n1", 10), { allocated: 11, remaining: 0, coverage: 100, fulfilled: true });
});

test("resource coverage reports partial and zero-quantity requests safely", () => {
  assert.deepEqual(allocationCoverage([{ request_id: "n", quantity: 2 }], "n", 5), { allocated: 2, remaining: 3, coverage: 40, fulfilled: false });
  assert.equal(allocationCoverage([], "empty", 0).coverage, 0);
});
