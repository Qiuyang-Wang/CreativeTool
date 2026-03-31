const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

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

        if (dist < radius) {
            let force = (radius - dist) / radius;

            // Core deformation (pushing outwards)
            p.x -= dx * 0.05 * force;
            p.y -= dy * 0.05 * force;
        }

        // Slowly return to the original position
        p.x += (p.originalX - p.x) * 0.05;
        p.y += (p.originalY - p.y) * 0.05;
    });

    // Draw lines (grid)
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        let p = points[i];
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
    }
    ctx.fill();

    requestAnimationFrame(draw);
}

draw();