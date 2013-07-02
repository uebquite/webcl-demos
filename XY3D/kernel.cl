constant int n = 64, m = 63,  sh = 6,  sh2 = 12;

float en( float x ){
  const float pi2 = M_PI_F + M_PI_F;
  return native_cos(pi2 * x);
}

__kernel void kSpin(global float* s, global uint* rand, int bw, float rT ){
  int x = get_global_id(0),  y = get_global_id(1),  ny = (y<<sh),
    z = get_global_id(2),  nnz = (z<<sh2);
  int  t = x + ny + nnz;
  float sn = s[t];
  if ( ((x + y + z) & 1) == bw) return;
  uint r = 1664525u * rand[t] + 1013904223u;
  float s0 = sn;
  sn += (r/4294967295.0f - .5f)*.1f + 1.0f;
  sn -= floor(sn);
  r = 1664525u * r + 1013904223u;
  rand[t] = r;

  float si = s[((x + 1)&m) + ny + nnz];
  float e = en(si - s0) - en(si - sn);
  si = s[((x + m)&m) + ny + nnz];
  e += en(si - s0) - en(si - sn);
  si = s[x + (((y + 1)&m)<<sh) + nnz];
  e += en(si - s0) - en(si - sn);
  si = s[x + (((y + m)&m)<<sh) + nnz];
  e += en(si - s0) - en(si - sn);
  si = s[x + ny + (((z + 1)&m)<<sh2)];
  e += en(si - s0) - en(si - sn);
  si = s[x + ny + (((z + m)&m)<<sh2)];
  e += en(si - s0) - en(si - sn);

  if (r > 4294967295.0f*native_exp(-e*rT)) sn = s0;
  s[t] = sn;
}

int iClamp(int i){
  return min( max( 0, i), 255 );
}
float angle(float a){
  if( a > 0.5f) return a - 1.0f;
  else if( a > -0.5f) return a;
  else return a + 1.0f;
}

__kernel void kPix(global float* s, global uchar4* pix) {
  int x = get_global_id(0),  y = get_global_id(1),  ny = (y<<sh),
    z = get_global_id(2),  nnz = (z<<sh2);
  int x1 = (x + 1)&m,  y1 = ((y + 1)&m)<<sh, z1 = ((z + 1)&m)<<sh2;
  float s0 = s[x + ny + nnz];
  float sx = s[x1+ ny + nnz];
  float sy = s[x + y1 + nnz];
  float sz = s[x + ny + z1];
  int vort = 0;
  float t = s[x1 + y1 + nnz];
  float sum = angle(sx - s0) + angle(t - sx) + angle(sy - t) + angle(s0 - sy);
  if (fabs(sum) > 0.9f) vort = 1;
  t = s[x + y1 + z1];
  sum = angle(sy - s0) + angle(t - sy) + angle(sz - t) + angle(s0 - sz);
  if (fabs(sum) > 0.9f) vort = 1;
  t = s[x1 + ny + z1];
  sum = angle(sz - s0) + angle(t - sz) + angle(sx - t) + angle(s0 - sx);
  if (fabs(sum) > 0.9f) vort = 1;
  if (vort == 1)
    pix[x + ny + nnz] = (uchar4)(255,255,255,0);
  else{
    int c = (int)( s0 * 1536.0f );
    pix[x + ny + nnz] = (uchar4)(
      iClamp( (int)abs(c - 768) - 256 ),
      iClamp( 512 - (int)abs(c - 512) ),
      iClamp( 512 - (int)abs(c - 1024) ),
      255);
  }
}
