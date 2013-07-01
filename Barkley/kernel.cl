constant int n = 512,  m = 511,  sh = 9;

__kernel void kBarkley(global float2* in,  global float2* out,
    float a1, float ba, float dt, float dte, float dth2){
  int x = get_global_id(0),  y = get_global_id(1),  a = x + (y<<sh);
  if (x >= m || y >= m) return;

  float u = in[a].x,  v = in[a].y;
  float vnew = v + (u - v)*dt,  uth = v*a1 + ba;
  float tmp = dte*(u - uth),  utmp = u*tmp;
  float unew = ( u < uth ) ? u/(1.0f + utmp - tmp) : (utmp + u)/(1.0f + utmp);
  unew += (in[a + 1].x + in[a - 1].x + in[a + n].x + in[a - n].x - 4.0f*u)*dth2;
  out[a] = (float2)(unew, vnew);
}

__kernel void kShow(global float2* inp, global uchar4* pix ){
  int a = get_global_id(0) + (get_global_id(1) <<sh);
  float2 t = inp[a];
  pix[a] = (uchar4)( (uchar)(255.0f*t.x), (uchar)(255.0f*t.y), 0, 255);
}
