constant int n = 1024;
constant float h = 1.0f/1024.0f, c = 8.0f/4294967295.0f;

__kernel void kPath(read_only image2d_t p, global uint* rand,
write_only image2d_t p1, int bw, float ga ) {
    const sampler_t samp =
        CLK_NORMALIZED_COORDS_TRUE|CLK_ADDRESS_REPEAT|CLK_FILTER_NEAREST;
    int ix = get_global_id(0),  iy = get_global_id(1);
    if ( (iy & 1) == bw) return;

    int t = ix + 4*iy;
    uint sum = 0;
    uint r = 1664525u * rand[t] + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    float dx = (sum*c -3.0f)*ga;
    sum = 0;
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    r = 1664525u * r + 1013904223u;  sum += (r >> 3);
    float dy = (sum*c -3.0f)*ga;
    rand[t] = r;
    float x = .25f*(ix + .5f),  y = h*(iy + .5f);
    float2 p_new = (read_imagef(p, samp, (float2)(x, y + h) ).xy +
    read_imagef(p, samp, (float2)(x, y - h) ).xy)*.5f + (float2)(dx, dy);
    p_new = fmin(fmax(p_new, 0.0f), 1.0f);
    write_imagef(p1, (int2)(ix, iy), (float4)( p_new, 0.0f, 0.0f) );
}

__kernel void kPixXY(read_only image2d_t p, read_only image2d_t p1,
    global float2* pix) {
    const sampler_t samp =
        CLK_NORMALIZED_COORDS_FALSE|CLK_ADDRESS_CLAMP|CLK_FILTER_NEAREST;
    int x = get_global_id(0),  y = get_global_id(1);
    float2 c;
    if ( (y & 1) == 0) c = read_imagef(p, samp, (int2)(x, y) ).xy;
    else c = read_imagef(p1, samp, (int2)(x, y) ).xy;
    pix[y + n*x] = 2.0f*c - 1.0f;
}

__kernel void kPixXT(read_only image2d_t p, read_only image2d_t p1,
    global float2* pix) {
    const sampler_t samp =
        CLK_NORMALIZED_COORDS_FALSE|CLK_ADDRESS_CLAMP|CLK_FILTER_NEAREST;
    int x = get_global_id(0),  y = get_global_id(1);
    float c;
    if ( (y & 1) == 0) c = read_imagef(p, samp, (int2)(x, y) ).x;
    else c = read_imagef(p1, samp, (int2)(x, y) ).x;
    pix[y + n*x] = 2.0f*(float2)(c, h*y) - 1.0f;
}

__kernel void kPixYT(read_only image2d_t p, read_only image2d_t p1,
    global float2* pix) {
    const sampler_t samp =
        CLK_NORMALIZED_COORDS_FALSE|CLK_ADDRESS_CLAMP|CLK_FILTER_NEAREST;
    int x = get_global_id(0),  y = get_global_id(1);
    float c;
    if ( (y & 1) == 0) c = read_imagef(p, samp, (int2)(x, y) ).y;
    else c = read_imagef(p1, samp, (int2)(x, y) ).y;
    pix[y + n*x] = 2.0f*(float2)(c, h*y) - 1.0f;
}
