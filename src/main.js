(function loadscene() {

    var form

    var canvas, canvas2, gl, gl2, vp_size, prog, bufObj = {}, mousepos = [0, 0];
    let duplicateCanvas = false

    let seed = Math.random() * 50
    let firstRound = false

    function isElementVerticallyInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
        );
    }

    function calculateMeanBrightness() {
        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4); // 4 bytes per pixel (RGBA)
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let totalBrightness = 0;
        const numPixels = width * height;

        for (let i = 0; i < pixels.length; i += 4) {
            const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            totalBrightness += brightness;
        }

        return totalBrightness / numPixels;
    }

    function calculateLuminance(rgb) {
        let a = rgb.map(v => v / 255).map(v => {
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function adjustCanvasBrightness() {
        firstRound = true

        // let meanBrightness = calculateMeanBrightness();
        // let canvasLuminance = calculateLuminance([meanBrightness, meanBrightness, meanBrightness]);

        // if (canvasLuminance > 0.3) {
        //     canvas.className = "contrast"
        //     canvas2.className = ""
        // } else {
        //     canvas.className = ""
        //     canvas2.className = ""
        // }

        const imageData = gl2.getImageData(100, 100, 150, 150);
        const data = imageData.data;
        const colorCounts = {};
        const threshold = 128; 
    
        for (let i = 0; i < data.length; i += 100) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
    
            // Calculate contrast with white (255, 255, 255)
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
            if (luminance < threshold) {
                const color = `rgb(${r},${g},${b})`;
                if (!colorCounts[color]) {
                    colorCounts[color] = 0;
                }
                colorCounts[color]++;
            }
        }

        delete colorCounts["rgb(0,0,0)"]

        let dominantColor = '';
        let maxCount = 0;
    
        for (const color in colorCounts) {
            if (colorCounts[color] > maxCount) {
                maxCount = colorCounts[color];
                dominantColor = color;
            }
        }
        form.style.setProperty('--bg-color', (dominantColor || "#000"))
    }

    function initScene() {

        canvas = document.getElementById("canvas");
        canvas2 = document.getElementById("canvas2");
        form = document.getElementById("NewsletterForm")
        gl = canvas.getContext("webgl");
        gl2 = canvas2.getContext('2d');
        if (!gl)
            return;

        canvas.addEventListener('mousemove', (e) => {
            mousepos = [e.clientX, e.clientY];
        });

        progDraw = gl.createProgram();
        for (let i = 0; i < 2; ++i) {
            let source = document.getElementById(i == 0 ? "draw-shader-vs" : "draw-shader-fs").text;
            let shaderObj = gl.createShader(i == 0 ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
            gl.shaderSource(shaderObj, source);
            gl.compileShader(shaderObj);
            let status = gl.getShaderParameter(shaderObj, gl.COMPILE_STATUS);
            if (!status) alert(gl.getShaderInfoLog(shaderObj));
            gl.attachShader(progDraw, shaderObj);
            gl.linkProgram(progDraw);
        }
        status = gl.getProgramParameter(progDraw, gl.LINK_STATUS);
        if (!status) alert(gl.getProgramInfoLog(progDraw));
        progDraw.inPos = gl.getAttribLocation(progDraw, "inPos");
        progDraw.iTime = gl.getUniformLocation(progDraw, "iTime");
        progDraw.iMouse = gl.getUniformLocation(progDraw, "iMouse");
        progDraw.iResolution = gl.getUniformLocation(progDraw, "iResolution");
        gl.useProgram(progDraw);

        var pos = [-1, -1, 1, -1, 1, 1, -1, 1];
        var inx = [0, 1, 2, 0, 2, 3];
        bufObj.pos = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bufObj.pos);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
        bufObj.inx = gl.createBuffer();
        bufObj.inx.len = inx.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufObj.inx);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inx), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(progDraw.inPos);
        gl.vertexAttribPointer(progDraw.inPos, 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        window.onresize = resize;
        resize();
        requestAnimationFrame(render);
    }

    function resize() {
        vp_size = [window.innerWidth, window.innerHeight];
        canvas.width = vp_size[0];
        canvas.height = vp_size[1];
    }

    function render(deltaMS) {

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniform1f(progDraw.iTime, (3000 + (seed) + deltaMS / 5000.0));
        gl.uniform2f(progDraw.iResolution, canvas.width, canvas.height);
        gl.uniform2f(progDraw.iMouse, mousepos[0], mousepos[1]);
        gl.drawElements(gl.TRIANGLES, bufObj.inx.len, gl.UNSIGNED_SHORT, 0);

        if (duplicateCanvas) {
            gl2.drawImage(canvas, 0, 0);
        }

        if (deltaMS % 1000.0 <= 15 || !firstRound) adjustCanvasBrightness()

        requestAnimationFrame(render);
    }

    initScene();

    const footer = document.getElementsByTagName("footer")[0]

    document.addEventListener("scroll", e => {
        duplicateCanvas = isElementVerticallyInViewport(footer)
    })

})();