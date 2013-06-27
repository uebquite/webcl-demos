
function sobelJS(inputCanvas, outputCanvas, inputContext, outputContext) {
// For testing, set to true to test basic imageData update
    var nullFilter = false;

    var width = inputCanvas.width;
    var height = inputCanvas.height;

    var inputImageData = inputContext.getImageData(0, 0, width, height);
    var outputImageData = outputContext.getImageData(0, 0, width, height);

    var inputPixels = inputImageData.data;
    var outputPixels = outputImageData.data;

    var input = function (off) { return [inputPixels[off] / 255, inputPixels[off + 1] / 255, inputPixels[off + 2] / 255, inputPixels[off + 3] / 255]; };
    var output = function (off, p) { outputPixels[off] = 255 * p[0]; outputPixels[off + 1] = 255 * p[1]; outputPixels[off + 2] = 255 * p[2]; outputPixels[off + 3] = 255; };
    var x, y;

    for (x = 0; x < width; x++) {
        for (y = 0; y < height; y++) {
            var Gx = [0, 0, 0, 0];
            var Gy = [0, 0, 0, 0];
            var C =  [0, 0, 0, 0];

            // Original
            // var c = x + y * width;
            var c = (x * 4) + (y * width * 4);

            /* Read each texel component and calculate the filtered value using neighbouring texel components */
            if (x >= 1 && x < (width - 1) && y >= 1 && y < height - 1) {
                var i00 = input(c - 4 - 4 * width);
                var i10 = input(c - 4 * width);
                var i20 = input(c + 4 - 4 * width);
                var i01 = input(c - 4);
                var i11 = input(c);
                var i21 = input(c + 4);
                var i02 = input(c - 4 + 4 * width);
                var i12 = input(c + 4 * width);
                var i22 = input(c + 4 + 4 * width);

                for (i = 0; i < 4; i++) {
                    Gx[i] = i00[i] + 2 * i10[i] + i20[i] - i02[i] - 2 * i12[i] - i22[i];
                    Gy[i] = i00[i] - i20[i] + 2 * i01[i] - 2 * i21[i] + i02[i] - i22[i];
                    C[i]  = Math.sqrt(Gx[i] * Gx[i] + Gy[i] * Gy[i]) / 2;
                }

                // Update outputPixels
                if (nullFilter) {
                    output(c, input(c));
                } else {
                    output(c, C);
                }
            }
        }
    }

    outputContext.putImageData(outputImageData, 0, 0);
}