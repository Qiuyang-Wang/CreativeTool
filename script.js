// DOM references
// When the page loads, retrieve all the required elements in one go and store them in variables.
// This is done to avoid repeatedly searching the DOM within the animation loop, which makes it slightly faster.
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const intensitySlider = document.getElementById("intensity");
const intensityValue = document.getElementById("intensityValue");
const modeButtons = document.querySelectorAll(".modeBtn");
const resetBtn = document.getElementById("resetBtn");

const colorBtn = document.getElementById("colorBtn");

// Grid constants
// spacing is the distance between points, set to 40px.
// After testing, this value feels just right—if it’s too dense, you can’t see the movement of individual points; if it’s too sparse, it doesn’t look like a cohesive field.
// radius is the radius of the mouse’s influence area, set to 120px.
// A larger radius makes the pushing sensation feel more like a real collision.
const spacing = 40;
const radius = 120;

// State variables\
// `mode` records the current distortion mode, and `intensity` is a value between 0 and 1 representing the intensity.\
// `isDrawing` determines whether the user is holding down the mouse button, and `lastX/Y` records the position from the previous frame, which is used for interpolation.\
// `colorMode` is a colour index, cycling through 0–3.
let mode = "liquid";
let intensity = Number(intensitySlider.value) / 100;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let colorMode = 0;

// The intensity is set to 40 by default, so you’ll see a noticeable effect as soon as you open it; there’s no need to adjust it yourself.
intensitySlider.value = 40;
intensity = 0.4;

// The `points` array stores all the points; each point contains its current position, initial position and velocity.
let points = [];

// Canvas dimensions
// getBoundingClientRect retrieves the actual dimensions rendered by CSS (the 4:3 aspect ratio is controlled by the stylesheet),
// and writes them to the canvas’s pixel buffer. This ensures that mouse coordinates and point coordinates are in the same coordinate space, preventing misalignment.
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
            points.push({ x, y, ox: x, oy: y, vx: 0, vy: 0 });
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
//   Elastic ×6.0 — High force; points bounce away and return, like stretching a rubber band
//   Heat    ×1.5 + sine noise — Low force, but with lateral jitter, resembling rippling heat waves
function applyDistortion(px, py) {
    points.forEach((p) => {
        const dx   = p.x - px;
        const dy   = p.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) return;

        const force = Math.pow(1 - dist / radius, 2) * intensity * 0.4;
        const nx    = dx / (dist || 1);  // Normalise the direction vector; use 1 when dist=0 to prevent division by zero
        const ny    = dy / (dist || 1);

        if (mode === "liquid") {
            p.vx += nx * force * 2.5;
            p.vy += ny * force * 2.5;

        } else if (mode === "elastic") {
            p.vx += nx * force * 6.0;
            p.vy += ny * force * 6.0;

        } else if (mode === "heat") {
            p.vx += nx * force * 1.5;
            p.vy += ny * force * 1.5;
            // The sine values are calculated using both the time and the point’s Y-coordinate, so that points in different rows have different phases,
            // making it look as though the ripples are spreading horizontally rather than vibrating in unison.
            p.vx += Math.sin(Date.now() * 0.02 + p.y * 0.1) * 0.2;
        }
    });
}

// Pointer events
// `pointerdown` supports mice, touch and styluses; pressing triggers a distortion immediately.
// There is no need to move the pointer first for a response; the effect is visible from the very first touch.
canvas.addEventListener("pointerdown", (e) => {
    isDrawing = true;
    const pos = getPointerPos(e);
    lastX = pos.x;
    lastY = pos.y;
    applyDistortion(pos.x, pos.y);
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

// I listen to the `window` object rather than the `canvas` because the cursor may have moved outside the canvas area by the time the mouse button is released;
// if I attached the event handler to the `canvas`, I would not be able to capture this event.
window.addEventListener("pointerup", () => {
    isDrawing = false;
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
    });
});

// The colours cycle through four values: grey, red, yellow and blue.
// The limited selection is intentional; too many colours can be distracting, and the focus should remain on the distorted shapes.
colorBtn.addEventListener("click", () => {
    colorMode = (colorMode + 1) % 4;
});

// Rendering loop
// `requestAnimationFrame` synchronises the animation with the screen refresh rate, updating the physics state and the display on every frame.
// Placing physics and rendering within the same loop eliminates the overhead of iterating through the `points` array twice.
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach((p) => {
        // Multiply the speed by 0.9 per frame; the energy is gradually depleted, and the dot will naturally slow down and come to a stop.
        // Without this, the dot would just keep floating indefinitely.
        p.vx *= 0.9;
        p.vy *= 0.9;

        p.x += p.vx;
        p.y += p.vy;

        // When the speed is extremely low, it is set to zero directly to avoid processing movements that are imperceptible to the naked eye.
        if (Math.abs(p.vx) < 0.01) p.vx = 0;
        if (Math.abs(p.vy) < 0.01) p.vy = 0;

        // Each point is drawn as a circle with a radius of 2px; this is small enough to reveal changes in density, yet large enough for individual points to be clearly visible.
        ctx.beginPath();
        let color;

        if (colorMode === 0) {
            color = "#888";
        } else if (colorMode === 1) {
            color = "#ec0706";
        } else if (colorMode === 2) {
            color = "#fec107";
        } else {
            color = "#0403fa";
        }

        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
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
    // Export the current frame as a PNG
    const link = document.createElement("a");
    link.download = "distortion.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});