
function runFilterJS(t, cx, cy, diag) {
    var inputImageData = inputContext.getImageData(0, 0, width, height);
    var outputImageData = outputContext.getImageData(0, 0, width, height);

    var inputPixels = inputImageData.data;
    var outputPixels = outputImageData.data;

    tStart = new Date().valueOf();

    runRippleJS(inputPixels, outputPixels, t, cx, cy, diag);

    tEnd = new Date().valueOf();

    outputContext.putImageData(outputImageData, 0, 0);
    showResults();
}

function runRippleJS(inputPixels, outputPixels, t, cx, cy, diag) {
    var ix, iy, x, y;
    var iu, iv, u, v;

    var offxy;
    var offuv;

    var pix;

    var I = function (off) { return [inputPixels[off], inputPixels[off + 1], inputPixels[off + 2], inputPixels[off + 3]]; };
    var O = function (off, p) { outputPixels[off] = p[0]; outputPixels[off + 1] = p[1]; outputPixels[off + 2] = p[2]; outputPixels[off + 3] = p[3]; };

    for (iy = 0; iy < height; iy++) {
        y = iy - cy;

        for (ix = 0; ix < width; ix++) {
            x = ix - cx;

            var r = Math.sqrt((x * x) + (y * y));
            var q = Math.sin(r / 16 - t);
            var s = 4 * q * ((diag - r) / diag);

            var dx = 0;
            var dy = 0;

            if (r !== 0) {
                dx = Math.floor((s * x) / r);
                dy = Math.floor((s * y) / r);
            }

            u = x + dx;
            v = y + dy;

            iu = u + cx;
            iv = v + cy;

            iu = (iu < 0) ? 0 : iu;
            iv = (iv < 0) ? 0 : iv;
            iu = (iu >= width) ? width - 1 : iu;
            iv = (iv >= height) ? height - 1 : iv;

            offxy = 4 * (iy * width + ix);
            offuv = 4 * (iv * width + iu);

            pix = I(offuv);
            var rd = pix[0];
            var gr = pix[1];
            var bl = pix[2];
            q = q / 2;
            pix[0] = rd + (rd / 256) * q * (255 - rd);
            pix[1] = gr + (gr / 256) * q * (255 - gr);
            pix[2] = bl + (bl / 256) * q * (255 - bl);
            O(offxy, pix);
        }
    }
}
