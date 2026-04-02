const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resetBtn = document.getElementById("resetBtn");
const colorBtn = document.getElementById("colorBtn");

let colorMode = 0;
let isDrawing = false;

canvas.addEventListener("mousedown", () => {
    isDrawing = true;
});

canvas.addEventListener("mouseup", () => {
    isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
    isDrawing = false;
});

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Grid parameters
const spacing = 40;
let points = [];

// Mouse position
let mouse = { x: 0, y: 0 };

// Create grid points
for (let x = 0; x < canvas.width; x += spacing) {
    for (let y = 0; y < canvas.height; y += spacing) {
        points.push({
            x: x,
            y: y,
            originalX: x,
            originalY: y
        });
    }
}

// Move the mouse
canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// Draw
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach(p => {
        let dx = mouse.x - p.x;
        let dy = mouse.y - p.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        let radius = 120;

        if (isDrawing && dist < radius) {
            let force = (radius - dist) / radius;

            p.x -= dx * 0.08 * force;
            p.y -= dy * 0.08 * force;
        }

        // Slowly return to the original position
        p.x += (p.originalX - p.x) * 0.02;
        p.y += (p.originalY - p.y) * 0.02;
    });

    // Draw lines (grid)
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        let p = points[i];
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
    }
    points.forEach(p => {
        ctx.beginPath();

        if (colorMode === 0) {
            ctx.fillStyle = "#333";
        } else if (colorMode === 1) {
            ctx.fillStyle = "blue";
        } else {
            ctx.fillStyle = "purple";
        }

        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(draw);
}

draw();

resetBtn.addEventListener("click", () => {
    points.forEach(p => {
        p.x = p.originalX;
        p.y = p.originalY;
    });
});

colorBtn.addEventListener("click", () => {
    colorMode = (colorMode + 1) % 3;
});

