export interface LinearStep {
  idx: number;
  val: number;
  found: boolean;
  checked: number[];
}

export interface BinaryStep {
  low: number;
  high: number;
  mid: number;
  val: number;
  found: boolean;
  checked: number[];
}

export const calculateLinearSteps = (array: number[], target: number): LinearStep[] => {
  const steps: LinearStep[] = [];
  for (let idx = 0; idx < array.length; idx++) {
    const val = array[idx];
    const stepInfo: LinearStep = {
      idx,
      val,
      found: val === target,
      checked: Array.from({ length: idx + 1 }, (_, i) => i)
    };
    steps.push(stepInfo);
    if (val === target) break;
  }
  return steps;
};

export const calculateBinarySteps = (array: number[], target: number): BinaryStep[] => {
  const steps: BinaryStep[] = [];
  let low = 0;
  let high = array.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const val = array[mid];
    const stepInfo: BinaryStep = {
      low,
      high,
      mid,
      val,
      found: val === target,
      checked: [mid]
    };
    steps.push(stepInfo);
    if (val === target) {
      break;
    } else if (val < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return steps;
};
