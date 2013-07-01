constant int n = 512, m = 511, sh = 9;
constant float h = 1.0f/512.0f;

__kernel void kP(global float* P, global float* G, global float* P1 ) {
    int x = get_global_id(0),  y = get_global_id(1),  ny = y<<sh;
    P1[x + ny] = (P[((x + m)&m) + ny] + P[((x + 1)&m) + ny] +
        P[x + (((y + 1)&m)<<sh)] + P[x + (((y + m)&m)<<sh)] - G[x + ny]) *.25f;
}

__kernel void kShow(global float* D, global uchar4* bPix ) {
    int a = get_global_id(0) + (get_global_id(1)<<sh);
    int rg = (int)(255.0f*(1.0f + D[a]));
    bPix[a] = (uchar4)( (uchar)clamp(rg, 0,255), (uchar)clamp(rg, 0,255),
        (uchar)clamp(255 + rg, 0,255), (uchar)255 );
}

__kernel void kAdvec(global float2* U, global float* D,
    global float2* U1, global float* D1) {
    const float dt = .001f, tau = .5f*dt/h;

    int x = get_global_id(0),  y = get_global_id(1),  ny = y<<sh;
    float2 Dr = -tau*(float2)( U[x + ny].x + U[((x + m)&m) + ny].x,
    U[x + ny].y + U[x + (((y + m)&m)<<sh)].y);
    float2 Df = floor(Dr),  Dd = Dr - Df;
    int x1 = (x + (int)Df.x + n)&m,  x11 = (x1 + 1)&m;
    int ny1 = (y + (int)Df.y + n)&m,  ny11 = ((ny1 + 1)&m)<<sh;
    ny1 = ny1<<sh;
    D1[x + ny] =
        (D[x1  + ny1]*(1.0f - Dd.y) + D[x1  + ny11]*Dd.y)*(1.0f - Dd.x) +
        (D[x11 + ny1]*(1.0f - Dd.y) + D[x11 + ny11]*Dd.y)*Dd.x;
    U1[x + ny] =
        (U[x1  + ny1]*(1.0f - Dd.y) + U[x1  + ny11]*Dd.y)*(1.0f - Dd.x) +
        (U[x11 + ny1]*(1.0f - Dd.y) + U[x11 + ny11]*Dd.y)*Dd.x;
}

__kernel void kG(global float2* U, global float* G ) {
    int x = get_global_id(0),  y = get_global_id(1),  ny = y<<sh;
    G[x + ny] = (U[x + ny].x - U[((x + m)&m) + ny].x +
        U[x + ny].y - U[x + (((y + m)&m)<<sh)].y ) * h;
}

__kernel void kDiv(global float2* U, global float* P, global float2* U1) {
    int x = get_global_id(0),  y = get_global_id(1),  ny = y<<sh;
    float2 u = U[x + ny];
    u.x -= (P[((x + 1)&m) + ny] - P[x + ny])*n;
    u.y -= (P[x + (((y + 1)&m)<<sh)] - P[x + ny])*n;
    U1[x + ny] = u;
}

__kernel void kForce(global float2* U, global float* D,
    global float2* U1, float c) {
    int x = get_global_id(0),  y = get_global_id(1),  ny = y<<sh;
    float2 u = U[x + ny];
    u.y += c*(D[x + ny] + D[x + (((y + 1)&m)<<sh)]);
    U1[x + ny] = u;
}
