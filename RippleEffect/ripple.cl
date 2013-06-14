__kernel void Ripple_kernel(
            __global float* input,
            __global float* output,
            const    int    width,
            const    int    height,
            const    float  diag,
            const    int     t,
            const    int     cx,
            const    int     cy)
{
    int ix = get_global_id(0);
    int iy = get_global_id(1);

    float x = ix - cx;
    float y = iy - cy;

    float r = sqrt(x * x + y * y);
    float q = sin(r / 16 - t);
    float s = 4 * q * ((diag - r) / diag);

    float dx = 0.0f;
    float dy = 0.0f;

    if( r != 0.0f) {
        dx = (s * x) / r;
        dy = (s * y) / r;
    }

    float u = x + dx;
    float v = y + dy;

    // bilinear interpolation

    int u1 = floor(u);
    int v1 = floor(v);

    int u2 = u1 + 1;
    int v2 = v1 + 1;

    int iu1 = clamp(u1 + cx, 0, width - 1);
    int iv1 = clamp(v1 + cy, 0, height - 1);
    int iu2 = clamp(u2 + cx, 0, width - 1);
    int iv2 = clamp(v2 + cy, 0, height - 1);

    int offxy   = 4 * (iy * width + ix);
    int offu1v1 = 4 * (iv1 * width + iu1);
    int offu1v2 = 4 * (iv2 * width + iu1);
    int offu2v1 = 4 * (iv1 * width + iu2);
    int offu2v2 = 4 * (iv2 * width + iu2);

    float f11 = (u2 - u) * (v2 - v);
    float f12 = (u2 - u) * (v - v1);
    float f21 = (u - u1) * (v2 - v);
    float f22 = (u - u1) * (v - v1);

    q = q / 2;
    int k;
    float pix;

    for (k = 0; k < 4; k++) {
        pix = f11 * input[offu1v1 + k] + f12 * input[offu1v2 + k] + f21 * input[offu2v1 + k] + f22 * input[offu2v2 + k];
        output[offxy + k] = pix + (pix / 256) * q * (255 - pix);
    }
}
