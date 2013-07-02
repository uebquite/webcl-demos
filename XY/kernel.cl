constant int n = 512;
constant float h = 1.0f/512.0f, hy = 2.0f/512.0f;

float en( float x ){
  const float pi2 = M_PI_F + M_PI_F;
  return native_cos(pi2 * x);
}

__kernel void kSpinW(read_only image2d_t sB, read_only image2d_t sW,
    write_only image2d_t sW1, global uint* rand, float rT ) {
  const sampler_t samp =
    CLK_NORMALIZED_COORDS_TRUE|CLK_ADDRESS_REPEAT|CLK_FILTER_NEAREST;
  int ix = get_global_id(0),  iy = get_global_id(1),  t = ix + n*iy;
  float x = h*(ix + .5f),  y = hy*(iy + .5f);
  float s0 = read_imagef(sW, samp, (float2)(x, y)).x;
  uint r = 1664525u * rand[t] + 1013904223u;
  float snew = s0 + (r/4294967295.0f - .5f)*.1f + 1.0f;
  snew -= floor(snew);
  r = 1664525u * r + 1013904223u;
  rand[t] = r;

  float sh = ((ix & 1) == 0) ? 0.0f : hy;
  float si = read_imagef(sB, samp, (float2)(x, y + hy)).x;
  float e = en(si - s0) - en(si - snew);
  si = read_imagef(sB, samp, (float2)(x, y)).x;
  e += en(si - s0) - en(si - snew);
  si = read_imagef(sB, samp, (float2)(x + h, y + sh)).x;
  e += en(si - s0) - en(si - snew);
  si = read_imagef(sB, samp, (float2)(x - h, y + sh)).x;
  e += en(si - s0) - en(si - snew);

  if (r > 4294967295.0f*native_exp(-e*rT)) snew = s0;
  write_imagef(sW1, (int2)(ix, iy), (float4)(snew, .0f,.0f,.0f));
}

__kernel void kSpinB(read_only image2d_t sB, read_only image2d_t sW,
    write_only image2d_t sB1, global uint* rand, float rT ) {
  const sampler_t samp =
    CLK_NORMALIZED_COORDS_TRUE|CLK_ADDRESS_REPEAT|CLK_FILTER_NEAREST;
  int ix = get_global_id(0),  iy = get_global_id(1),  t = ix + n*iy;
  float x = h*(ix + .5f),  y = hy*(iy + .5f);
  float s0 = read_imagef(sB, samp, (float2)(x, y)).x;
  uint r = 1664525u * rand[t] + 1013904223u;
  float snew = s0 + (r/4294967295.0f - .5f)*.1f + 1.0f;
  snew -= floor(snew);
  r = 1664525u * r + 1013904223u;
  rand[t] = r;

  float sh = ((ix & 1) == 0) ? -hy : 0.0f;
  float si = read_imagef(sW, samp, (float2)(x, y)).x;
  float e = en(si - s0) - en(si - snew);
  si = read_imagef(sW, samp, (float2)(x, y - hy)).x;
  e += en(si - s0) - en(si - snew);
  si = read_imagef(sW, samp, (float2)(x + h, y + sh)).x;
  e += en(si - s0) - en(si - snew);
  si = read_imagef(sW, samp, (float2)(x - h, y + sh)).x;
  e += en(si - s0) - en(si - snew);

  if (r > 4294967295.0f*native_exp(-e*rT)) snew = s0;
  write_imagef(sB1, (int2)(ix, iy), (float4)(snew, .0f,.0f,.0f));
}

int iClamp(int i){
  return min( max( 0, i), 255 );
}

__kernel void kPix(read_only image2d_t sB, read_only image2d_t sW,
    global uchar4* pix) {
  const sampler_t samp =
    CLK_NORMALIZED_COORDS_FALSE|CLK_ADDRESS_CLAMP|CLK_FILTER_NEAREST;
  int x = get_global_id(0),  y = get_global_id(1);
  int y2 = y >> 1;
  int c;
  if ( ((x + y) & 1) == 0)
    c = (int)( read_imagef(sB, samp, (int2)(x, y2) ).x * 1536.0f );
  else c = (int)( read_imagef(sW, samp, (int2)(x, y2 ) ).x * 1536.0f );
  pix[x + n*y] = (uchar4)(
    iClamp( (int)abs(c - 768) - 256 ),
    iClamp( 512 - (int)abs(c - 512) ),
    iClamp( 512 - (int)abs(c - 1024) ),
    255);
}
