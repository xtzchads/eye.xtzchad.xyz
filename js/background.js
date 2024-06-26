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

    Particle.prototype.h = function() {
        this.g.beginPath();
        this.g.fillStyle = this.particleColor;
        this.g.globalAlpha = 0.7;
        this.g.arc(this.x, this.y, 1.5, 0, 2 * Math.PI);
        this.g.fill();
    };

    function ParticleNetwork(element, options) {
        this.i = element;
        this.i.size = {
            width: this.i.offsetWidth,
            height: this.i.offsetHeight
        };
        options = options || {};
        this.options = {
            particleColor: options.particleColor !== undefined ? options.particleColor : '#fff',
            background: options.background !== undefined ? options.background : '#1a252f',
            interactive: options.interactive !== undefined ? options.interactive : true,
            velocity: this.setVelocity(options.speed),
            density: this.j(options.density)
        };
        this.init();
    }

    ParticleNetwork.prototype.init = function() {
        this.k = document.createElement('div');
        this.i.appendChild(this.k);
        this.l(this.k, {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0
        });

        if (/^#[0-9A-F]{6}$/i.test(this.options.background)) {
            this.l(this.k, {
                background: this.options.background
            });
        } else {
            if (!/\.(gif|jpg|jpeg|tiff|png)$/i.test(this.options.background)) {
                console.error('Please specify a valid background image or hexadecimal color');
                return false;
            }
            this.l(this.k, {
                background: 'url("' + this.options.background + '") no-repeat center',
                'background-size': 'cover'
            });
        }

        if (!/^#[0-9A-F]{6}$/i.test(this.options.particleColor)) {
            console.error('Please specify a valid particleColor hexadecimal color');
            return false;
        }

        this.canvas = document.createElement('canvas');
        this.i.appendChild(this.canvas);
        this.g = this.canvas.getContext('2d');
        this.canvas.width = this.i.size.width;
        this.canvas.height = this.i.size.height;

        this.l(this.i, {
            position: 'absolute'
        });
        this.l(this.canvas, {
            position: 'absolute'
        });

        window.addEventListener('resize', function() {
            if (this.i.offsetWidth === this.i.size.width && this.i.offsetHeight === this.i.size.height) {
                return false;
            }
            this.canvas.width = this.i.size.width = this.i.offsetWidth;
            this.canvas.height = this.i.size.height = this.i.offsetHeight;
            clearTimeout(this.m);
            this.m = setTimeout(function() {
                this.o = [];
                for (var a = 0; a < this.canvas.width * this.canvas.height / this.options.density; a++) {
                    this.o.push(new Particle(this));
                }
                if (this.options.interactive) {
                    this.o.push(this.p);
                }
                requestAnimationFrame(this.update.bind(this));
            }.bind(this), 500);
        }.bind(this));

        this.o = [];
        for (var a = 0; a < this.canvas.width * this.canvas.height / this.options.density; a++) {
            this.o.push(new Particle(this));
        }

        if (this.options.interactive) {
            this.p = new Particle(this);
            this.p.velocity = {
                x: 0,
                y: 0
            };
            this.o.push(this.p);

            this.canvas.addEventListener('mousemove', function(event) {
                this.p.x = event.clientX - this.canvas.offsetLeft;
                this.p.y = event.clientY - this.canvas.offsetTop;
            }.bind(this));

            this.canvas.addEventListener('mouseup', function() {
                this.p.velocity = {
                    x: (Math.random() - 0.5) * this.options.velocity,
                    y: (Math.random() - 0.5) * this.options.velocity
                };
                this.p = new Particle(this);
                this.p.velocity = {
                    x: 0,
                    y: 0
                };
                this.o.push(this.p);
            }.bind(this));
        }

        requestAnimationFrame(this.update.bind(this));
    };

    ParticleNetwork.prototype.update = function() {
        this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.g.globalAlpha = 1;

        for (var a = 0; a < this.o.length; a++) {
            this.o[a].update();
            this.o[a].h();
            for (var b = this.o.length - 1; b > a; b--) {
                var c = Math.sqrt(Math.pow(this.o[a].x - this.o[b].x, 2) + Math.pow(this.o[a].y - this.o[b].y, 2));
                if (c > 120) {
                    continue;
                }
                this.g.beginPath();
                this.g.strokeStyle = this.options.particleColor;
                this.g.globalAlpha = (120 - c) / 120;
                this.g.lineWidth = 0.7;
                this.g.moveTo(this.o[a].x, this.o[a].y);
                this.g.lineTo(this.o[b].x, this.o[b].y);
                this.g.stroke();
            }
        }

        if (this.options.velocity !== 0) {
            requestAnimationFrame(this.update.bind(this));
        }
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

    ParticleNetwork.prototype.j = function(density) {
        if (density === 'high') {
            return 5000;
        } else if (density === 'low') {
            return 20000;
        } else if (isNaN(parseInt(density, 10))) {
            return 10000;
        } else {
            return parseInt(density, 10);
        }
    };

    ParticleNetwork.prototype.l = function(element, styles) {
        for (var property in styles) {
            element.style[property] = styles[property];
        }
    };

    if (typeof define === 'function' && define.amd) {
        define(['exports'], function(exports) {
            global.ParticleNetwork = ParticleNetwork;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = ParticleNetwork;
    } else {
        global.ParticleNetwork = ParticleNetwork;
    }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
