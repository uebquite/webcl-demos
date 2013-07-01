constant int n = 512;
constant float h = 1.0f/512.0f;

__kernel void kSpin(read_only image2d_t s, global uint* rand,
  write_only image2d_t s1, int bw, constant float* w ) {
  const sampler_t samp =
    CLK_NORMALIZED_COORDS_TRUE|CLK_ADDRESS_REPEAT|CLK_FILTER_NEAREST;
  int ix = get_global_id(0),  iy = get_global_id(1);
  if ( ((ix + iy) % 2) == bw) return;
  int t = ix + n*iy;
  uint r = 1664525u * rand[t] + 1013904223u;
  rand[t] = r;
  float x = h*(ix + .5f),  y = h*(iy + .5f);
  int sum = read_imagei(s, samp, (float2)(x + h, y)).x;
  sum += read_imagei(s, samp, (float2)(x - h, y)).x;
  sum += read_imagei(s, samp, (float2)(x, y + h)).x;
  sum += read_imagei(s, samp, (float2)(x, y - h)).x;
  int c = (r < w[sum]) ? 0 : 1;
  write_imagei(s1, (int2)(ix, iy), c );
}

__kernel void kPix(read_only image2d_t s, read_only image2d_t s1,
    global uchar4* pix) {
  const sampler_t samp =
    CLK_NORMALIZED_COORDS_FALSE|CLK_ADDRESS_CLAMP|CLK_FILTER_NEAREST;
  int x = get_global_id(0),  y = get_global_id(1);
  int c;
  if ( ((x + y) % 2) == 0) c = read_imagei(s, samp, (int2)(x, y) ).x;
  else c = read_imagei(s1, samp, (int2)(x, y) ).x;
  c *= 255;
  pix[x + n*y] = (uchar4)(c,c,c,255);
}
