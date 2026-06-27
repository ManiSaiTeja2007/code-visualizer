import { describe, test, expect } from "vitest";
import { calculateLinearSteps, calculateBinarySteps } from "./search";

describe("Search Steps Calculations", () => {
  const array = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

  test("Linear search finds target correctly", () => {
    // 23 is at index 5
    const steps = calculateLinearSteps(array, 23);
    
    expect(steps.length).toBe(6);
    expect(steps[5].val).toBe(23);
    expect(steps[5].found).toBe(true);
    expect(steps[4].found).toBe(false);
    expect(steps[5].checked).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("Linear search handles missing targets", () => {
    // 99 is missing, checking all elements
    const steps = calculateLinearSteps(array, 99);
    expect(steps.length).toBe(10);
    expect(steps[9].found).toBe(false);
  });

  test("Binary search finds target in log steps", () => {
    // 23 is at index 5
    const steps = calculateBinarySteps(array, 23);
    
    // Binary search splits:
    // 1st: low=0, high=9, mid=4 (val=16) -> val < target, low = 5
    // 2nd: low=5, high=9, mid=7 (val=56) -> val > target, high = 6
    // 3rd: low=5, high=6, mid=5 (val=23) -> Found!
    expect(steps.length).toBe(3);
    expect(steps[2].val).toBe(23);
    expect(steps[2].found).toBe(true);
  });

  test("Binary search handles missing target correctly", () => {
    const steps = calculateBinarySteps(array, 7);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[steps.length - 1].found).toBe(false);
  });
});
