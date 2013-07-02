__kernel void sobel_filter(
__global float* input,
__global float* output,
const    uint    width,
const    uint    height)
{
    uint x = get_global_id(0);
    uint y = get_global_id(1);

    float Gx[4];
    float Gy[4];

    int c = (x*4) + (y * width * 4);
    int k;

    /* Read each texel component and calculate the filtered
    value using neighbouring texel components */
    if (x >= 1 && x < (width - 1) && y >= 1 && y < height - 1) {
        float i00[4];
        float i10[4];
        float i20[4];
        float i01[4];
        float i11[4];
        float i21[4];
        float i02[4];
        float i12[4];
        float i22[4];
        for (k=0; k<4; k++) {
            i00[k] = (float) input[(c - 4 - 4 * width) + k];
            i10[k] = (float) input[(c - 4 * width) + k];
            i20[k] = (float) input[(c + 4 - 4 * width) + k];
            i01[k] = (float) input[(c - 4) + k];
            i11[k] = (float) input[c + k];
            i21[k] = (float) input[(c + 4) + k];
            i02[k] = (float) input[(c - 4 + 4 * width) + k];
            i12[k] = (float) input[(c + 4 * width) + k];
            i22[k] = (float) input[(c + 4 + 4 * width) + k];

            Gx[k] = i00[k] + 2 * i10[k] + i20[k] - i02[k] - 2 * i12[k] - i22[k];

            Gy[k] = i00[k] - i20[k] + 2 * i01[k] - 2 * i21[k] + i02[k] - i22[k];

            /* taking root of sums of squares of Gx and Gy */
            output[c + k] = (float) (hypot(Gx[k], Gy[k])) / 2;
        }
    }
}
