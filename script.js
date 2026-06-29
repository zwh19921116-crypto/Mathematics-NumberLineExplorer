const svg = document.getElementById("numberLine");
const operationEl = document.getElementById("operation");
const firstNumberEl = document.getElementById("firstNumber");
const secondNumberEl = document.getElementById("secondNumber");
const firstSliderEl = document.getElementById("firstSlider");
const secondSliderEl = document.getElementById("secondSlider");
const speedEl = document.getElementById("speed");
const playBtn = document.getElementById("playBtn");
const stepBtn = document.getElementById("stepBtn");
const resetBtn = document.getElementById("resetBtn");
const equationEl = document.getElementById("equation");
const explanationEl = document.getElementById("explanation");
const animationHintEl = document.getElementById("animationHint");

const state = {
  min: -12,
  max: 12,
  jumps: [],
  start: 0,
  result: 0,
  stepIndex: 0,
  animationFrame: null,
  runId: 0,
  animating: false,
  guideOriginal: { from: 0, to: 0, label: "Original" },
  guideChange: { from: 0, to: 0, label: "Change" },
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
  let guideOriginal = { from: 0, to: 0, label: "Original" };
  let guideChange = { from: 0, to: 0, label: "Change" };

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

    equation = `${a} + ${b} = ${result}`;
    explanation = `Start at ${a}. Move ${Math.abs(b)} step(s) ${b >= 0 ? "to the right" : "to the left"}.`;
    guideOriginal = { from: 0, to: a, label: `Original ${a}` };
    guideChange = { from: a, to: result, label: `Change ${b >= 0 ? "+" : ""}${b}` };
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

    equation = `${a} - ${b} = ${result}`;
    const direction = b >= 0 ? "to the left" : "to the right";
    explanation = `Start at ${a}. Subtracting ${b} means move ${Math.abs(b)} step(s) ${direction}.`;
    guideOriginal = { from: 0, to: a, label: `Original ${a}` };
    guideChange = { from: a, to: result, label: `Change ${b >= 0 ? "-" : "+"}${Math.abs(b)}` };
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

    equation = `${a} × ${b} = ${result}`;
    explanation = `Multiplication is repeated jumps: jump ${stepSize} for ${totalSteps} time(s).`;
    guideOriginal = { from: 0, to: a, label: `Original ${a}` };
    guideChange = { from: 0, to: result, label: `Change ${result >= 0 ? "+" : ""}${result}` };
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

      equation = `${a} ÷ ${b} = ${result}`;
      explanation = `Division counts equal jumps of size ${Math.abs(b)} until reaching ${a}. Total jumps = ${result}.`;
      guideOriginal = { from: 0, to: a, label: `Original ${a}` };
      guideChange = { from: 0, to: b, label: `Change per jump ${b}` };
    }
  }

  return { jumps, start, result, equation, explanation, valid, message, guideOriginal, guideChange };
}

function drawGuideArrow({ from, to, label, color, yOffset }) {
  const baseY = 190;
  const x1 = xForValue(from);
  const x2 = xForValue(to);

  if (Math.abs(x2 - x1) < 0.5) {
    return;
  }

  const y = baseY + yOffset;
  const markerId = `arrow-${color.replace("#", "")}`;
  const defs = svg.querySelector("defs");

  if (defs && !svg.querySelector(`#${markerId}`)) {
    const marker = createSvgNode("marker", {
      id: markerId,
      markerWidth: "10",
      markerHeight: "8",
      refX: "9",
      refY: "4",
      orient: "auto",
    });
    marker.appendChild(
      createSvgNode("path", {
        d: "M0,0 L10,4 L0,8 z",
        fill: color,
      })
    );
    defs.appendChild(marker);
  }

  svg.appendChild(
    createSvgNode("line", {
      x1,
      y1: y,
      x2,
      y2: y,
      stroke: color,
      "stroke-width": "3",
      "marker-end": `url(#${markerId})`,
      opacity: "0.85",
      class: "guide-arrow",
    })
  );

  svg.appendChild(
    createSvgNode(
      "text",
      {
        x: (x1 + x2) / 2,
        y: y - 8,
        "text-anchor": "middle",
        fill: color,
        class: "guide-label",
      },
      label
    )
  );
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

    if (isMajor) {
      svg.appendChild(
        createSvgNode(
          "text",
          {
            x,
            y: baseY + 36,
            "text-anchor": "middle",
            "font-size": "15",
            fill: "var(--line)",
            "font-family": "Manrope, sans-serif",
          },
          String(value)
        )
      );
    }
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

  drawGuideArrow({
    ...state.guideOriginal,
    color: "#007f5f",
    yOffset: 58,
  });

  drawGuideArrow({
    ...state.guideChange,
    color: "#0f6ab4",
    yOffset: 82,
  });
}

function jumpArcHeight(jump) {
  return 46 + (Math.abs(jump.to - jump.from) > 1 ? 14 : 0);
}

function getBezierPoint(jump, t) {
  const baseY = 190;
  const x1 = xForValue(jump.from);
  const x2 = xForValue(jump.to);
  const cx = (x1 + x2) / 2;
  const cy = baseY - jumpArcHeight(jump);

  const mt = 1 - t;
  const x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
  const y = mt * mt * (baseY - 3) + 2 * mt * t * cy + t * t * (baseY - 3);
  return { x, y };
}

function drawProgress(completedCount = state.stepIndex, activeJump = null, activeT = 0) {
  const baseY = 190;

  const existing = svg.querySelectorAll(
    ".jump, .jump-label, .current, .result-label, .active-hop, .traveler"
  );
  existing.forEach((node) => node.remove());

  let currentPos = state.start;

  for (let i = 0; i < completedCount; i += 1) {
    const jump = state.jumps[i];
    const x1 = xForValue(jump.from);
    const x2 = xForValue(jump.to);
    const arcHeight = jumpArcHeight(jump);
    const path = `M ${x1} ${baseY - 3} Q ${(x1 + x2) / 2} ${baseY - arcHeight} ${x2} ${baseY - 3}`;

    svg.appendChild(
      createSvgNode("path", {
        d: path,
        class: "jump",
        fill: "none",
        stroke: "var(--jump)",
        opacity: "0.65",
        "stroke-width": "2.8",
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

  if (activeJump) {
    const x1 = xForValue(activeJump.from);
    const x2 = xForValue(activeJump.to);
    const arcHeight = jumpArcHeight(activeJump);
    const path = `M ${x1} ${baseY - 3} Q ${(x1 + x2) / 2} ${baseY - arcHeight} ${x2} ${baseY - 3}`;

    const activePath = createSvgNode("path", {
      d: path,
      class: "active-hop",
      fill: "none",
      stroke: "var(--jump-active)",
      "stroke-width": "4",
      "marker-end": "url(#arrow)",
    });
    svg.appendChild(activePath);

    const totalLength = activePath.getTotalLength();
    activePath.style.strokeDasharray = String(totalLength);
    activePath.style.strokeDashoffset = String((1 - activeT) * totalLength);

    const p = getBezierPoint(activeJump, activeT);
    svg.appendChild(
      createSvgNode("circle", {
        cx: p.x,
        cy: p.y,
        r: "8",
        class: "traveler",
        fill: "#d83f31",
      })
    );

    animationHintEl.textContent = `Hop ${completedCount + 1} of ${state.jumps.length}: ${activeJump.from} to ${activeJump.to}`;
    return;
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

    animationHintEl.textContent = `Complete. Result is ${state.result}.`;
  } else {
    animationHintEl.textContent = `Ready. Press Play Animation, or Step Once to move one hop.`;
  }
}

function stopAnimation() {
  state.runId += 1;
  state.animating = false;
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
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
    explanationEl.textContent = model.message;
    state.jumps = [];
    state.start = 0;
    state.result = 0;
    state.stepIndex = 0;
    state.min = -12;
    state.max = 12;
    state.guideOriginal = { from: 0, to: 0, label: "Original" };
    state.guideChange = { from: 0, to: 0, label: "Change" };
    animationHintEl.textContent = model.message;
    drawNumberLine();
    return;
  }

  state.jumps = model.jumps;
  state.start = model.start;
  state.result = model.result;
  state.stepIndex = 0;
  state.guideOriginal = model.guideOriginal;
  state.guideChange = model.guideChange;

  const allValues = [state.start, state.result, ...state.jumps.flatMap((j) => [j.from, j.to])];
  const range = clampRange(allValues);
  state.min = range.min;
  state.max = range.max;

  equationEl.textContent = model.equation;
  explanationEl.textContent = model.explanation;
  animationHintEl.textContent = `Original value ${a}. Change value ${b}.`;
  drawNumberLine();
}

function stepForward() {
  if (!state.animating && state.stepIndex < state.jumps.length) {
    animateSingleHop(state.stepIndex, Math.max(220, parseIntSafe(speedEl.value) || 550));
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateSingleHop(index, duration, runId = state.runId) {
  if (index >= state.jumps.length) {
    return Promise.resolve();
  }

  state.animating = true;
  const jump = state.jumps[index];

  return new Promise((resolve) => {
    const start = performance.now();

    const frame = (now) => {
      if (runId !== state.runId) {
        state.animating = false;
        resolve();
        return;
      }

      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      drawProgress(index, jump, easeInOutCubic(t));

      if (t < 1) {
        state.animationFrame = requestAnimationFrame(frame);
        return;
      }

      state.stepIndex = index + 1;
      state.animating = false;
      drawProgress();
      resolve();
    };

    state.animationFrame = requestAnimationFrame(frame);
  });
}

async function playAnimation() {
  stopAnimation();
  const runId = state.runId;

  if (state.stepIndex >= state.jumps.length) {
    state.stepIndex = 0;
    drawProgress();
  }

  if (state.jumps.length === 0) {
    return;
  }

  const speed = Math.max(220, parseIntSafe(speedEl.value) || 550);
  for (let i = state.stepIndex; i < state.jumps.length; i += 1) {
    if (runId !== state.runId) {
      return;
    }
    await animateSingleHop(i, speed, runId);
    if (i < state.jumps.length - 1) {
      await wait(70);
    }
  }
}

operationEl.addEventListener("change", applyScenario);

firstSliderEl.addEventListener("input", () => {
  firstNumberEl.value = firstSliderEl.value;
  applyScenario();
});

secondSliderEl.addEventListener("input", () => {
  secondNumberEl.value = secondSliderEl.value;
  applyScenario();
});

firstNumberEl.addEventListener("input", () => {
  firstSliderEl.value = String(parseIntSafe(firstNumberEl.value));
  applyScenario();
});

secondNumberEl.addEventListener("input", () => {
  secondSliderEl.value = String(parseIntSafe(secondNumberEl.value));
  applyScenario();
});

playBtn.addEventListener("click", playAnimation);
stepBtn.addEventListener("click", () => {
  stopAnimation();
  stepForward();
});
resetBtn.addEventListener("click", applyScenario);

function setSliderBounds() {
  const op = operationEl.value;

  if (op === "divide") {
    firstSliderEl.min = "0";
    firstSliderEl.max = "40";
    secondSliderEl.min = "-12";
    secondSliderEl.max = "12";
  } else {
    firstSliderEl.min = "-20";
    firstSliderEl.max = "20";
    secondSliderEl.min = "-20";
    secondSliderEl.max = "20";
  }
}

operationEl.addEventListener("change", () => {
  setSliderBounds();
  firstSliderEl.value = String(parseIntSafe(firstNumberEl.value));
  secondSliderEl.value = String(parseIntSafe(secondNumberEl.value));
});

setSliderBounds();
firstSliderEl.value = String(parseIntSafe(firstNumberEl.value));
secondSliderEl.value = String(parseIntSafe(secondNumberEl.value));

applyScenario();
