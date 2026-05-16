// DOM references
// When the page loads, retrieve all the required elements in one go and store them in variables.
// This is done to avoid repeatedly searching the DOM within the animation loop, which makes it slightly faster.
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const intensitySlider = document.getElementById("intensity");
const intensityValue = document.getElementById("intensityValue");
const modeButtons = document.querySelectorAll(".modeBtn");
const resetBtn = document.getElementById("resetBtn");
const dotColorPicker = document.getElementById("dotColor");
const densitySlider = document.getElementById("density");
const bgColorPicker = document.getElementById("bgColor");
const undoBtn = document.getElementById("undoBtn");
const shapeBtn = document.getElementById("shapeBtn");
const landingEl = document.getElementById("landing");
const landingBtn = document.getElementById("landingBtn");

// Grid constants
// spacing is the distance between points, set to 40px.
// After testing, this value feels just right—if it's too dense, you can't see the movement of individual points; if it's too sparse, it doesn't look like a cohesive field.
// radius is the radius of the mouse's influence area, set to 120px.
// A larger radius makes the pushing sensation feel more like a real collision.
let spacing = 40;
const radius = 120;

// State variables\
// `mode` records the current distortion mode, and `intensity` is a value between 0 and 1 representing the intensity.\
// `isDrawing` determines whether the user is holding down the mouse button, and `lastX/Y` records the position from the previous frame, which is used for interpolation.\
// `dotColor` is the current dot colour; `dotShape` is the current shape, cycling through circle, square and triangle.
let mode = "liquid";
let intensity = Number(intensitySlider.value) / 100;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let attractMode = false;
let dotColor = "#888888";
let dotShape = "circle";
const shapes = ["circle", "square", "triangle"];
let bgColor = "#faf7f2";

let audioCtx = null;
let currentAudioNodes = null;

// The intensity is set to 40 by default, so you'll see a noticeable effect as soon as you open it; there's no need to adjust it yourself.
intensitySlider.value = 40;
intensity = 0.4;

// The `points` array stores all the points; each point contains its current position, initial position and velocity.
let points = [];

// Undo stack stores snapshots of point positions before each stroke
let undoStack = [];

function saveSnapshot() {
    undoStack.push(points.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, mode: p.mode })));
    // Keep the stack at a reasonable size
    if (undoStack.length > 30) undoStack.shift();
}

// Canvas dimensions
// getBoundingClientRect retrieves the actual dimensions rendered by CSS (the 4:3 aspect ratio is controlled by the stylesheet),
// and writes them to the canvas's pixel buffer. This ensures that mouse coordinates and point coordinates are in the same coordinate space, preventing misalignment.
// The grid is rebuilt every time the window size changes, ensuring that the points cover the entire canvas.
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    createGrid();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Create a grid
// Generate points in a neat grid pattern, moving from left to right and top to bottom at intervals specified by `spacing`.
// `ox` and `oy` store the original coordinates; when resetting, these values are used directly to restore the grid, eliminating the need for recalculation.
function createGrid() {
    points = [];
    for (let x = 0; x <= canvas.width; x += spacing) {
        for (let y = 0; y <= canvas.height; y += spacing) {
            points.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, mode: "" });
        }
    }
}


// Mouse coordinate transformation
// The browser returns viewport coordinates; to obtain coordinates within the canvas, you must subtract the offset from the top-left corner of the canvas.
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}


// Distortion calculation\
// Each time the effect is triggered, all points are traversed; points within the radius range are pushed away.\
// The force is attenuated quadratically: the closer to the mouse, the greater the force; at the edges, it is barely perceptible.
// This formula appears more natural, with a smoother transition between the centre and the edges.
//
// The main difference between the three modes lies in the force multiplier, which produces distinct physical sensations:
//   Liquid  ×2.5 — Moderate force; points drift slowly, as if gliding across water
//   Elastic ×12.0 — High force; points snap out hard and stay where they land
//   Heat    ×1.5 + sine noise — Low force, but with lateral jitter, resembling rippling heat waves
function applyDistortion(px, py) {
    points.forEach((p) => {
        const dx   = p.x - px;
        const dy   = p.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) return;

        p.mode = mode;

        const force = Math.pow(1 - dist / radius, 2) * intensity * 0.4;
        const nx        = dx / (dist || 1);
        const ny        = dy / (dist || 1);
        const direction = attractMode ? -1 : 1;

        if (mode === "liquid") {
            p.vx += nx * force * 2.5 * direction;
            p.vy += ny * force * 2.5 * direction;

        } else if (mode === "elastic") {
            p.vx += nx * force * 12.0 * direction;
            p.vy += ny * force * 12.0 * direction;

        } else if (mode === "heat") {
            p.vx += nx * force * 1.5 * direction;
            p.vy += ny * force * 1.5 * direction;
            // The sine values are calculated using both the time and the point's Y-coordinate, so that points in different rows have different phases,
            // making it look as though the ripples are spreading horizontally rather than vibrating in unison.
            p.vx += Math.sin(Date.now() * 0.02 + p.y * 0.1) * 0.2;
        }
    });
}

function createNoiseBuffer(ctx) {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

function startAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    stopAudio();

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.connect(audioCtx.destination);

    if (mode === "liquid") {
        const source = audioCtx.createBufferSource();
        source.buffer = createNoiseBuffer(audioCtx);
        source.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 200;
        filter.Q.value = 2.5;

        const tremolo = audioCtx.createOscillator();
        tremolo.type = "sine";
        tremolo.frequency.value = 0.3;
        const tremoloGain = audioCtx.createGain();
        tremoloGain.gain.value = 0.02;
        tremolo.connect(tremoloGain);
        tremoloGain.connect(gain.gain);
        tremolo.start();

        gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.08);
        source.connect(filter);
        filter.connect(gain);
        source.start();

        currentAudioNodes = { source, lfo: tremolo, gain };

    } else if (mode === "elastic") {
        const osc = audioCtx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = 200;

        const lfo = audioCtx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 8;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.linearRampToValueAtTime(0.07, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        osc.start();
        lfo.start();

        currentAudioNodes = { source: osc, lfo, gain };

    } else if (mode === "heat") {
        const source = audioCtx.createBufferSource();
        source.buffer = createNoiseBuffer(audioCtx);
        source.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 2200;
        filter.Q.value = 0.8;

        gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.08);
        source.connect(filter);
        filter.connect(gain);
        source.start();

        currentAudioNodes = { source, gain };
    }
}

function stopAudio() {
    if (!currentAudioNodes) return;
    const nodes = currentAudioNodes;
    currentAudioNodes = null;

    const stopTime = audioCtx.currentTime + 0.1;
    nodes.gain.gain.linearRampToValueAtTime(0, stopTime);

    setTimeout(() => {
        try { nodes.source.stop(); } catch (e) {}
        if (nodes.lfo) try { nodes.lfo.stop(); } catch (e) {}
    }, 150);
}

canvas.addEventListener("pointerdown", (e) => {
    saveSnapshot();
    isDrawing = true;
    const pos = getPointerPos(e);
    lastX = pos.x;
    lastY = pos.y;
    applyDistortion(pos.x, pos.y);
    startAudio();
});

// When moving quickly, the browser does not trigger events for every single pixel, so there is a gap between events.
// Use linear interpolation to interpolate points between the previous position and the current position; the longer the distance travelled, the more points are interpolated.
// This ensures the trajectory remains continuous and does not feel disjointed.
canvas.addEventListener("pointermove", (e) => {
    if (!isDrawing) return;

    const pos = getPointerPos(e);

    const dx = pos.x - lastX;
    const dy = pos.y - lastY;
    const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 10));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = lastX + dx * t;
        const y = lastY + dy * t;
        applyDistortion(x, y);
    }

    lastX = pos.x;
    lastY = pos.y;
});

window.addEventListener("pointerup", () => {
    isDrawing = false;
    stopAudio();
});

// Control events
// The slider value is divided by 100 to convert it to a value between 0 and 1. It updates in real time as the user drags it, allowing them to immediately feel the change in force.
intensitySlider.addEventListener("input", () => {
    intensity = Number(intensitySlider.value) / 100;

    if (intensityValue) {
        intensityValue.textContent = intensitySlider.value;
    }
});

// Use the `data-mode` attribute to retrieve the mode name; this way, adding a new mode only requires updating the HTML, so no changes are needed here.
// First clear all active states, then apply it to the clicked button to ensure that only one button is highlighted at any given time.
modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

// Reset sets the position and velocity of each point to zero, returning to the initial grid state.
// The contrast between the instantaneous changes and the slow unfolding of the distortion is like clearing a blank sheet of paper.
resetBtn.addEventListener("click", () => {
    points.forEach(p => {
        p.x = p.ox;
        p.y = p.oy;
        p.vx = 0;
        p.vy = 0;
        p.mode = "";
    });
    undoStack = [];
});

// Dot colour picker updates the colour used to draw all points.
dotColorPicker.addEventListener("input", () => {
    dotColor = dotColorPicker.value;
});

// Shape button cycles through circle, square and triangle; the label updates to show the current shape.
shapeBtn.addEventListener("click", () => {
    const idx = shapes.indexOf(dotShape);
    dotShape = shapes[(idx + 1) % shapes.length];
    shapeBtn.textContent = dotShape.charAt(0).toUpperCase() + dotShape.slice(1);
});

// Density slider rebuilds the grid with a new spacing value; the canvas is cleared and redrawn at the new density.
densitySlider.addEventListener("input", () => {
    spacing = Number(densitySlider.value);
    createGrid();
    undoStack = [];
});

// Background colour picker updates the canvas CSS background and the bgColor variable used during export.
bgColorPicker.addEventListener("input", () => {
    bgColor = bgColorPicker.value;
    canvas.style.background = bgColor;
});

// Undo restores the most recent snapshot from the stack.
undoBtn.addEventListener("click", () => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack.pop();
    snapshot.forEach((s, i) => {
        if (points[i]) {
            points[i].x = s.x;
            points[i].y = s.y;
            points[i].vx = s.vx;
            points[i].vy = s.vy;
            points[i].mode = s.mode;
        }
    });
});

// Landing overlay is dismissed when the user clicks Start.
landingBtn.addEventListener("click", () => {
    landingEl.style.display = "none";
});

// Rendering loop
// `requestAnimationFrame` synchronises the animation with the screen refresh rate, updating the physics state and the display on every frame.
// Placing physics and rendering within the same loop eliminates the overhead of iterating through the `points` array twice.
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach((p) => {
        const damping = p.mode === "liquid" ? 0.96 : 0.9;
        p.vx *= damping;
        p.vy *= damping;

        if (p.mode === "liquid") {
            const driftDist = Math.sqrt((p.x - p.ox) ** 2 + (p.y - p.oy) ** 2);
            if (driftDist < 100) {
                p.vy += 0.06;
            }
        }

        p.x += p.vx;
        p.y += p.vy;

        // When the speed is extremely low, it is set to zero directly to avoid processing movements that are imperceptible to the naked eye.
        if (Math.abs(p.vx) < 0.01) p.vx = 0;
        if (Math.abs(p.vy) < 0.01) p.vy = 0;

        // Each point is drawn using the globally selected colour and shape.
        ctx.fillStyle = dotColor;
        ctx.beginPath();

        if (dotShape === "circle") {
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        } else if (dotShape === "square") {
            // Square: Draw a 4×4 square centred on the point
            ctx.rect(p.x - 2, p.y - 2, 4, 4);
        } else if (dotShape === "triangle") {
            // Triangle: Draw an equilateral triangle with a point as its centre
            ctx.moveTo(p.x, p.y - 3);
            ctx.lineTo(p.x + 2.6, p.y + 1.5);
            ctx.lineTo(p.x - 2.6, p.y + 1.5);
            ctx.closePath();
        }

        ctx.fill();
    });

    requestAnimationFrame(draw);
}

draw();

// Export as PNG
// toDataURL converts the pixel data of the current frame into a Base64-encoded PNG.
// A temporary <a> tag triggers the download; no server is required, nor does it rely on external libraries.
// Place 'Save' at the end of the toolbar to indicate that it marks the end of the entire workflow.
const saveBtn = document.getElementById("saveBtn");

saveBtn.addEventListener("click", () => {
    // Before exporting, fill the canvas with the current background colour to cover the transparent background
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const link = document.createElement("a");
    link.download = "distortion.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});

const attractBtn = document.getElementById("attractBtn");

attractBtn.addEventListener("click", () => {
    attractMode = !attractMode;
    attractBtn.classList.toggle("active", attractMode);
});
