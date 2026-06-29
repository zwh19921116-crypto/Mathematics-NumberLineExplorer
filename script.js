const svg = document.getElementById("numberLine");
const operationEl = document.getElementById("operation");
const firstNumberEl = document.getElementById("firstNumber");
const secondNumberEl = document.getElementById("secondNumber");
const speedEl = document.getElementById("speed");
const playBtn = document.getElementById("playBtn");
const stepBtn = document.getElementById("stepBtn");
const resetBtn = document.getElementById("resetBtn");
const equationEl = document.getElementById("equation");

const state = {
  min: -12,
  max: 12,
  jumps: [],
  start: 0,
  result: 0,
  stepIndex: 0,
  timer: null,
};

function parseIntSafe(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function clampRange(values, pad = 2) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spanMin = Math.min(-12, minValue - pad);
  const spanMax = Math.max(12, maxValue + pad);
  return { min: spanMin, max: spanMax };
}

function xForValue(value) {
  const width = 920;
  const leftPad = 60;
  const rightPad = 60;
  const usable = width - leftPad - rightPad;
  return leftPad + ((value - state.min) / (state.max - state.min)) * usable;
}

function clearSvg() {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

function createSvgNode(tag, attrs = {}, text = "") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  if (text) {
    el.textContent = text;
  }
  return el;
}

function buildSteps(operation, a, b) {
  const jumps = [];
  let start = 0;
  let result = 0;
  let equation = "";
  let explanation = "";
  let valid = true;
  let message = "";

  if (operation === "add") {
    start = a;
    result = a + b;
    const stepDir = b >= 0 ? 1 : -1;
    const stepCount = Math.abs(b);
    let current = a;

    for (let i = 0; i < stepCount; i += 1) {
      const next = current + stepDir;
      jumps.push({ from: current, to: next, label: `${i + 1}` });
      current = next;
    }

    equation = `${a}+${b}=${result}`;
    explanation = `Starting number: ${a}. Operation: add ${b}. Move ${Math.abs(b)} step(s) ${b >= 0 ? "to the right" : "to the left"} to reach ${result}.`;
  }

  if (operation === "subtract") {
    start = a;
    result = a - b;
    const stepDir = b >= 0 ? -1 : 1;
    const stepCount = Math.abs(b);
    let current = a;

    for (let i = 0; i < stepCount; i += 1) {
      const next = current + stepDir;
      jumps.push({ from: current, to: next, label: `${i + 1}` });
      current = next;
    }

    equation = `${a}-${b}=${result}`;
    const direction = b >= 0 ? "to the left" : "to the right";
    explanation = `Starting number: ${a}. Operation: subtract ${b}. Move ${Math.abs(b)} step(s) ${direction} to reach ${result}.`;
  }

  if (operation === "multiply") {
    start = 0;
    result = a * b;
    const stepSize = b >= 0 ? a : -a;
    const totalSteps = Math.abs(b);
    let current = 0;

    for (let i = 0; i < totalSteps; i += 1) {
      const next = current + stepSize;
      jumps.push({ from: current, to: next, label: `${i + 1}` });
      current = next;
    }

    equation = `${a}×${b}=${result}`;
    explanation = `Starting number: ${a}. Operation: multiply by ${b}. This means repeated jumps of ${stepSize} for ${totalSteps} time(s), giving ${result}.`;
  }

  if (operation === "divide") {
    if (b === 0) {
      valid = false;
      message = "Division by zero is not allowed. Enter a non-zero second number.";
    } else if (!Number.isInteger(a / b)) {
      valid = false;
      message = "Use numbers that divide exactly so the number line steps stay clear for students.";
    } else {
      start = 0;
      result = a / b;
      const count = Math.abs(result);
      const stepSize = b * Math.sign(a === 0 ? 1 : a);
      let current = 0;

      for (let i = 0; i < count; i += 1) {
        const next = current + stepSize;
        jumps.push({ from: current, to: next, label: `${i + 1}` });
        current = next;
      }

      equation = `${a}÷${b}=${result}`;
      explanation = `Starting number: ${a}. Operation: divide by ${b}. Count equal jumps of size ${Math.abs(b)} until reaching ${a}; total jumps is ${result}.`;
    }
  }

  return { jumps, start, result, equation, explanation, valid, message };
}

function drawNumberLine() {
  clearSvg();

  const baseY = 190;
  const defs = createSvgNode("defs");
  const marker = createSvgNode("marker", {
    id: "arrow",
    markerWidth: "10",
    markerHeight: "8",
    refX: "9",
    refY: "4",
    orient: "auto",
  });

  marker.appendChild(
    createSvgNode("path", {
      d: "M0,0 L10,4 L0,8 z",
      fill: "var(--jump-active)",
    })
  );
  defs.appendChild(marker);
  svg.appendChild(defs);

  svg.appendChild(
    createSvgNode("line", {
      x1: xForValue(state.min),
      y1: baseY,
      x2: xForValue(state.max),
      y2: baseY,
      stroke: "var(--line)",
      "stroke-width": "3",
      "stroke-linecap": "round",
    })
  );

  for (let value = state.min; value <= state.max; value += 1) {
    const x = xForValue(value);
    const isMajor = value % 5 === 0 || value === 0;

    svg.appendChild(
      createSvgNode("line", {
        x1: x,
        y1: baseY - (isMajor ? 15 : 9),
        x2: x,
        y2: baseY + (isMajor ? 15 : 9),
        stroke: "var(--tick)",
        "stroke-width": isMajor ? "2" : "1.4",
      })
    );

    svg.appendChild(
      createSvgNode(
        "text",
        {
          x,
          y: baseY + 20,
          "text-anchor": "middle",
          "font-size": isMajor ? "13" : "11",
          fill: "var(--line)",
          "font-family": "Manrope, sans-serif",
          opacity: isMajor ? "1" : "0.9",
          "font-weight": isMajor ? "700" : "500",
        },
        String(value)
      )
    );
  }

  const startX = xForValue(state.start);
  svg.appendChild(
    createSvgNode("circle", {
      cx: startX,
      cy: baseY,
      r: "8",
      fill: "#007f5f",
    })
  );

  svg.appendChild(
    createSvgNode(
      "text",
      {
        x: startX,
        y: baseY - 18,
        "text-anchor": "middle",
        "font-size": "14",
        fill: "#007f5f",
        "font-family": "Manrope, sans-serif",
      },
      "Start"
    )
  );

  drawProgress();
}

function drawProgress() {
  const baseY = 190;

  const existing = svg.querySelectorAll(".jump, .jump-label, .current, .result-label");
  existing.forEach((node) => node.remove());

  let currentPos = state.start;

  for (let i = 0; i < state.stepIndex; i += 1) {
    const jump = state.jumps[i];
    const x1 = xForValue(jump.from);
    const x2 = xForValue(jump.to);
    const arcHeight = 46 + (Math.abs(jump.to - jump.from) > 1 ? 14 : 0);
    const path = `M ${x1} ${baseY - 3} Q ${(x1 + x2) / 2} ${baseY - arcHeight} ${x2} ${baseY - 3}`;

    svg.appendChild(
      createSvgNode("path", {
        d: path,
        class: "jump",
        fill: "none",
        stroke: "var(--jump-active)",
        "stroke-width": "3.5",
        "marker-end": "url(#arrow)",
      })
    );

    svg.appendChild(
      createSvgNode(
        "text",
        {
          x: (x1 + x2) / 2,
          y: baseY - arcHeight - 8,
          class: "jump-label",
          "text-anchor": "middle",
          "font-size": "14",
          fill: "var(--jump-active)",
          "font-family": "Manrope, sans-serif",
          "font-weight": "700",
        },
        jump.label
      )
    );

    currentPos = jump.to;
  }

  const currentX = xForValue(currentPos);
  svg.appendChild(
    createSvgNode("circle", {
      cx: currentX,
      cy: baseY,
      r: "8",
      class: "current",
      fill: "#d83f31",
    })
  );

  if (state.stepIndex === state.jumps.length) {
    svg.appendChild(
      createSvgNode(
        "text",
        {
          x: currentX,
          y: baseY - 38,
          class: "result-label",
          "text-anchor": "middle",
          "font-size": "15",
          fill: "#7b2cbf",
          "font-family": "Manrope, sans-serif",
          "font-weight": "700",
        },
        "Result"
      )
    );
  }
}

function stopAnimation() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function applyScenario() {
  stopAnimation();

  const operation = operationEl.value;
  const a = parseIntSafe(firstNumberEl.value);
  const b = parseIntSafe(secondNumberEl.value);
  const model = buildSteps(operation, a, b);

  if (!model.valid) {
    equationEl.textContent = `${a} ${operation === "divide" ? "÷" : "?"} ${b}`;
    state.jumps = [];
    state.start = 0;
    state.result = 0;
    state.stepIndex = 0;
    state.min = -12;
    state.max = 12;
    drawNumberLine();
    return;
  }

  state.jumps = model.jumps;
  state.start = model.start;
  state.result = model.result;
  state.stepIndex = 0;

  const allValues = [state.start, state.result, ...state.jumps.flatMap((j) => [j.from, j.to])];
  const range = clampRange(allValues);
  state.min = range.min;
  state.max = range.max;

  equationEl.textContent = model.equation;
  drawNumberLine();
}

function stepForward() {
  if (state.stepIndex < state.jumps.length) {
    state.stepIndex += 1;
    drawProgress();
  }
}

function playAnimation() {
  stopAnimation();

  if (state.stepIndex >= state.jumps.length) {
    state.stepIndex = 0;
    drawProgress();
  }

  if (state.jumps.length === 0) {
    return;
  }

  const speed = parseIntSafe(speedEl.value) || 550;
  state.timer = setInterval(() => {
    if (state.stepIndex >= state.jumps.length) {
      stopAnimation();
      return;
    }
    stepForward();
  }, speed);
}

operationEl.addEventListener("change", applyScenario);
firstNumberEl.addEventListener("input", applyScenario);
secondNumberEl.addEventListener("input", applyScenario);
playBtn.addEventListener("click", playAnimation);
stepBtn.addEventListener("click", () => {
  stopAnimation();
  stepForward();
});
resetBtn.addEventListener("click", applyScenario);

applyScenario();
