constant int n = 512;
constant float h = 1.0f/512.0f, del = .1f;

__kernel void kSpin(read_only image2d_t s, global uint* rand,
  write_only image2d_t s1, int bw, float rT ) {

    const sampler_t samp = CLK_NORMALIZED_COORDS_TRUE
                            | CLK_ADDRESS_REPEAT
                            | CLK_FILTER_NEAREST;

    int ix = get_global_id(0);
    int iy = get_global_id(1);
    int t = ix + n*iy;
    float x = h*(ix + .5f);
    float y = h*(iy + .5f);
    float en;
    float3 s0, snew;
    float3 v1, v2;
    uint r;

    snew = s0 = read_imagef(s, samp, (float2)(x, y)).xyz;
    if (((ix + iy) % 2) == bw){

        r = 1664525u * rand[t] + 1013904223u;
        v1 = fast_normalize( (float3)(s0.y, -s0.x, 0.0f) );
        v2 = cross(s0, v1)*(r/4294967295.0f - .5f)*del;

        r = 1664525u * r + 1013904223u;
        v1 = v1*(r/4294967295.0f - .5f)*del;

        r = 1664525u * r + 1013904223u;
        rand[t] = r;
        snew = fast_normalize(s0 + v1 + v2);

        v1 = snew - s0;
        en = -dot(read_imagef(s, samp, (float2)(x + h, y)).xyz, v1);
        en -= dot(read_imagef(s, samp, (float2)(x - h, y)).xyz, v1);
        en -= dot(read_imagef(s, samp, (float2)(x, y + h)).xyz, v1);
        en -= dot(read_imagef(s, samp, (float2)(x, y - h)).xyz, v1);

        if (r > 4294967295.0f * native_exp (-en * rT)) {
            snew = s0;
        }
    }

    write_imagef(s1, (int2)(ix, iy), (float4)(snew, 0.0f) );
}

float fclamp(float x) {
    return fmin(fmax(0.0f, x), 1.0f);
}

__kernel void kPix(read_only image2d_t s, global uchar4* pix) {

    const sampler_t samp = CLK_NORMALIZED_COORDS_FALSE
                            | CLK_ADDRESS_CLAMP
                            | CLK_FILTER_NEAREST;

    int x = get_global_id(0);
    int y = get_global_id(1);
    float3 t = read_imagef(s, samp, (int2)(x, y)).xyz;
    float a = 255.0f * fmin(t.z + 1.0f, 1.0f);
    float w = 255.0f * fmax(t.z, 0.0f);
    float c = atan2(t.y, t.x) * 0.955f + 3.0f;

    pix[y * n + x] = (uchar4)(
        (uchar) fmin(a * fclamp(fabs(c - 3.0f) - 1.0f) + w, 255.0f),
        (uchar) fmin(a * fclamp(2.0f - fabs(c - 2.0f)) + w, 255.0f),
        (uchar) fmin(a * fclamp(2.0f - fabs(c - 4.0f)) + w, 255.0f),
        255);
}

__kernel void kPixInterop(read_only image2d_t s, write_only image2d_t texBuf) {

    const sampler_t samp = CLK_NORMALIZED_COORDS_FALSE
                            | CLK_ADDRESS_CLAMP
                            | CLK_FILTER_NEAREST;

    int x = get_global_id(0);
    int y = get_global_id(1);
    float3 t = read_imagef(s, samp, (int2)(x, y)).xyz;
    float a = 255.0f * fmin(t.z + 1.0f, 1.0f);
    float w = 255.0f * fmax(t.z, 0.0f);
    float c = atan2(t.y, t.x) * 0.955f + 3.0f;
    float4 pixel;

    pixel = (float4)(
        (uchar) fmin(a * fclamp(fabs(c - 3.0f) - 1.0f) + w, 255.0f),
        (uchar) fmin(a * fclamp(2.0f - fabs(c - 2.0f)) + w, 255.0f),
        (uchar) fmin(a * fclamp(2.0f - fabs(c - 4.0f)) + w, 255.0f),
        255);

    pixel.x /= 255; pixel.y /= 255;
    pixel.z /= 255; pixel.w /= 255;

    write_imagef(texBuf, (int2)(x, y), pixel);
}
