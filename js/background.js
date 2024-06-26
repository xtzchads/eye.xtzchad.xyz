(function(global) {
    function Particle(options) {
        this.canvas = options.canvas;
        this.g = options.g;
        this.particleColor = options.options.particleColor;
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.velocity = {
            x: (Math.random() - 0.5) * options.options.velocity,
            y: (Math.random() - 0.5) * options.options.velocity
        };
    }

    Particle.prototype.update = function() {
        if (this.x > this.canvas.width + 20 || this.x < -20) {
            this.velocity.x = -this.velocity.x;
        }
        if (this.y > this.canvas.height + 20 || this.y < -20) {
            this.velocity.y = -this.velocity.y;
        }
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    };

    Particle.prototype.draw = function() {
        this.g.beginPath();
        this.g.fillStyle = this.particleColor;
        this.g.globalAlpha = 0.7;
        this.g.arc(this.x, this.y, 1.5, 0, 2 * Math.PI);
        this.g.fill();
    };

    Particle.prototype.drawConnection = function(otherParticle) {
        var distance = Math.sqrt(Math.pow(this.x - otherParticle.x, 2) + Math.pow(this.y - otherParticle.y, 2));
        if (distance > 120) {
            return;
        }
        this.g.beginPath();
        this.g.strokeStyle = this.particleColor;
        this.g.globalAlpha = (120 - distance) / 120;
        this.g.lineWidth = 0.7;
        this.g.moveTo(this.x, this.y);
        this.g.lineTo(otherParticle.x, otherParticle.y);
        this.g.stroke();
    };

    function ParticleNetwork(element, options) {
        this.element = element;
        this.options = {
            particleColor: options.particleColor || '#fff',
            background: options.background || '#1a252f',
            interactive: options.interactive !== undefined ? options.interactive : true,
            velocity: this.setVelocity(options.speed),
            density: this.setDensity(options.density)
        };
        this.init();
    }

    ParticleNetwork.prototype.init = function() {
        this.createCanvas();
        this.createParticles();
        this.setupEventListeners();
        this.animate();
    };

    ParticleNetwork.prototype.createCanvas = function() {
        this.canvas = document.createElement('canvas');
        this.element.appendChild(this.canvas);
        this.context = this.canvas.getContext('2d');
        this.resizeCanvas();
        this.element.style.position = 'relative';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.background = this.options.background;
    };

    ParticleNetwork.prototype.resizeCanvas = function() {
        this.canvas.width = this.element.offsetWidth;
        this.canvas.height = this.element.offsetHeight;
    };

    ParticleNetwork.prototype.createParticles = function() {
        this.particles = [];
        var particleCount = Math.floor(this.canvas.width * this.canvas.height / this.options.density);
        for (var i = 0; i < particleCount; i++) {
            this.particles.push(new Particle({
                canvas: this.canvas,
                g: this.context,
                options: this.options
            }));
        }
        if (this.options.interactive) {
            this.setupInteractiveParticle();
        }
    };

    ParticleNetwork.prototype.setupInteractiveParticle = function() {
        this.interactiveParticle = new Particle({
            canvas: this.canvas,
            g: this.context,
            options: this.options
        });
        this.particles.push(this.interactiveParticle);
        this.canvas.addEventListener('mousemove', this.updateInteractiveParticle.bind(this));
        this.canvas.addEventListener('mouseup', this.releaseInteractiveParticle.bind(this));
    };

    ParticleNetwork.prototype.updateInteractiveParticle = function(event) {
        this.interactiveParticle.x = event.clientX - this.canvas.offsetLeft;
        this.interactiveParticle.y = event.clientY - this.canvas.offsetTop;
    };

    ParticleNetwork.prototype.releaseInteractiveParticle = function() {
        this.interactiveParticle.velocity = {
            x: (Math.random() - 0.5) * this.options.velocity,
            y: (Math.random() - 0.5) * this.options.velocity
        };
        this.setupInteractiveParticle();
    };

    ParticleNetwork.prototype.animate = function() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (var i = 0; i < this.particles.length; i++) {
            var particle = this.particles[i];
            particle.update();
            particle.draw();
            for (var j = i + 1; j < this.particles.length; j++) {
                particle.drawConnection(this.particles[j]);
            }
        }
        requestAnimationFrame(this.animate.bind(this));
    };

    ParticleNetwork.prototype.setVelocity = function(speed) {
        if (speed === 'fast') {
            return 1;
        } else if (speed === 'slow') {
            return 0.33;
        } else if (speed === 'none') {
            return 0;
        } else {
            return 0.66;
        }
    };

    ParticleNetwork.prototype.setDensity = function(density) {
        if (density === 'high') {
            return 5000;
        } else if (density === 'low') {
            return 20000;
        } else if (!isNaN(parseInt(density, 10))) {
            return parseInt(density, 10);
        } else {
            return 10000;
        }
    };

    global.ParticleNetwork = ParticleNetwork;

})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);

// Initialization
var canvasDiv = document.getElementById('particle-canvas');
var options = {
    particleColor: '#888',
    interactive: true,
    speed: 'medium',
    density: 'high'
};
var particleCanvas = new ParticleNetwork(canvasDiv, options);
