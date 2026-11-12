export type Allocation = { request_id: string; quantity: number };

export function allocationCoverage(allocations: Allocation[], requestId: string, requestedQuantity: number) {
  const allocated = allocations
    .filter((allocation) => allocation.request_id === requestId)
    .reduce((total, allocation) => total + allocation.quantity, 0);
  const remaining = Math.max(0, requestedQuantity - allocated);
  const coverage = requestedQuantity > 0 ? Math.min(100, Math.round(allocated / requestedQuantity * 100)) : 0;
  return { allocated, remaining, coverage, fulfilled: remaining === 0 };
}
