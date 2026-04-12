const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const intensitySlider = document.getElementById("intensity");
const intensityValue = document.getElementById("intensityValue");
const modeButtons = document.querySelectorAll(".modeBtn");
const resetBtn = document.getElementById("resetBtn");

const spacing = 40;
const radius = 120;

let mode = "liquid";
let intensity = Number(intensitySlider.value) / 100;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let points = [];

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    createGrid();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function createGrid() {
    points = [];
    for (let x = 0; x <= canvas.width; x += spacing) {
        for (let y = 0; y <= canvas.height; y += spacing) {
            points.push({
                x,
                y,
                ox: x,
                oy: y,
                vx: 0,
                vy: 0
            });
        }
    }
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function applyDistortion(px, py) {
    points.forEach((p) => {
        const dx = p.x - px;
        const dy = p.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) return;

        const force = Math.pow(1 - dist / radius, 2) * intensity * 0.4;
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);

        if (mode === "liquid") {
            p.vx += nx * force * 2.5;
            p.vy += ny * force * 2.5;

        } else if (mode === "elastic") {
            p.vx += nx * force * 6.0;
            p.vy += ny * force * 6.0;

        } else if (mode === "heat") {
            p.vx += nx * force * 1.5;
            p.vy += ny * force * 1.5;

            p.x += Math.sin(Date.now() * 0.02 + p.y * 0.1) * 0.5;
        }
    });
}

canvas.addEventListener("pointerdown", (e) => {
    isDrawing = true;
    const pos = getPointerPos(e);
    lastX = pos.x;
    lastY = pos.y;
    applyDistortion(pos.x, pos.y);
});

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
});

intensitySlider.addEventListener("input", () => {
    intensity = Number(intensitySlider.value) / 100;
    intensityValue.textContent = intensitySlider.value;
});

modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

resetBtn.addEventListener("click", () => {
    points.forEach(p => {
        p.x = p.ox;
        p.y = p.oy;
        p.vx = 0;
        p.vy = 0;
    });
});

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach((p) => {
        p.vx *= 0.9;
        p.vy *= 0.9;

        p.x += p.vx;
        p.y += p.vy;

        if (Math.abs(p.vx) < 0.01) p.vx = 0;
        if (Math.abs(p.vy) < 0.01) p.vy = 0;

        ctx.beginPath();
        ctx.fillStyle = "#888";
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(draw);
}

draw();