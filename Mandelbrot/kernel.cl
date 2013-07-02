int iClamp(int i)
{
  return min(max(0, i), 255);
}

__kernel void ckMandelbrot(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);

    float Cr = (x - 256) * scale + Ro;
    float Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f;
    ushort n=0;
    while ( (R2+I2 < 4.0f) && (n < 1024) ){
      I=(R+R)*I+Ci;  R=R2-I2+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      int c = (int)((n % 64)*24.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckManZ2de(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);
    float Cr = (x - 256) * scale + Ro,  Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f, Dr=0.0f, Di=0.0f, D;
    ushort n=0;
    while ( (R2+I2 < 100.0f) && (n < 1024) ){
      D = 2.0f*(R*Dr - I*Di) + 1.0f;  Di = 2.0f*(R*Di + I*Dr);  Dr = D;
      I=(R+R)*I+Ci;  R=R2-I2+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      R = -(log(log(R2+I2)) + .5*log((R2+I2)/(Dr*Dr+Di*Di)));
      int c = (int)(200.*R) % 1536;
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckManZ2sm(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);
    float Cr = (x - 256) * scale + Ro,  Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f;
    ushort n=0;
    while ( (R2+I2 < 100.0f) && (n < 1024) ){
      I=(R+R)*I+Ci;  R=R2-I2+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      float cx = 1.4427f*(log(log(R2+I2)) - 1.52718f);
      int c = (int)(((n % 64) - cx)*24.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckManZ3(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);
    float Cr = (x - 256) * scale + Ro,  Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f;
    ushort n=0;
    while ( (R2+I2 < 4.0f) && (n < 1024) ){
      I=(3.0f*R2-I2)*I+Ci;  R=R*(R2-3.0f*I2)+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      int c = (int)((n % 64)*24.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckManZ3sm(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);
    float Cr = (x - 256) * scale + Ro,  Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f;
    ushort n=0;
    while ( (R2+I2 < 100.0f) && (n < 1024) ){
      I=(3.0f*R2-I2)*I+Ci;  R=R*(R2-3.0f*I2)+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      float cx = 0.91024f*(log(log(R2+I2)) - 1.52718f);
      int c = (int)(((n % 64) - cx)*24.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckManZ4(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);
    float Cr = (x - 256) * scale + Ro,  Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f, R2_I2, RI=R*I, RI4;
    ushort n=0;
    while ( (R2+I2 < 4.0f) && (n < 1024) ){
      R2_I2=R2-I2;   RI=R*I;   RI4=4.0f*RI;
      I=R2_I2*RI4+Ci;  R=R2_I2*R2_I2-RI4*RI+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      int c = (int)((n % 64)*24.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckManZ4sm(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);
    float Cr = (x - 256) * scale + Ro,  Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.0f,  I2=0.0f, R2=0.0f, R2_I2, RI=R*I, RI4;
    ushort n=0;
    while ( (R2+I2 < 100.0f) && (n < 1024) ){
      R2_I2=R2-I2;   RI=R*I;   RI4=4.0f*RI;
      I=R2_I2*RI4+Ci;  R=R2_I2*R2_I2-RI4*RI+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      float cx = 0.72135f*(log(log(R2+I2)) - 1.52718f);
      int c = (int)(((n % 64) - cx)*24.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }

  __kernel void ckMakin(__global uchar4* col,
      float scale, float Ro, float Io){
    ushort x = get_global_id(0),  y = get_global_id(1);

    float Cr = (x - 256) * scale + Ro;
    float Ci = -(y - 256) * scale + Io;
    float I=0.0f, R=0.00001f,  I2=0.0f, R2=0.0f;
    ushort n=0;
    while ( (fabs((I2)/(I+R)) < 10.0f) && (n < 1024) ){
      I=(R+R)*I+Ci;  R=R2-I2+Cr;  R2=R*R;  I2=I*I;  n++;
    }
    if (n == 1024) col[y*512 + x] = (uchar4)(0, 0, 0, 255);
    else{
      int c = (int)((n % 32)*48.0f);
      col[y*512 + x] = (uchar4)(
       iClamp( (int)abs(c - 768) - 384 ),
       iClamp( 512 - (int)abs(c - 512) ),
       iClamp( 512 - (int)abs(c - 1024) ),
       255);
    }
  }
