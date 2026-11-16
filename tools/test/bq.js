const fs=require('fs');
const f=process.argv[2];
const F=JSON.parse(fs.readFileSync(f));
const B=F.buildings.filter(b=>b.k!=='ship'&&!b.lh&&b.p.length>=3);
console.log('n',B.length);
const cen=b=>{let x=0,z=0;for(const p of b.p){x+=p[0];z+=p[1];}return [x/b.p.length,z/b.p.length];};
const area=b=>{let a=0;const n=b.p.length;for(let i=0;i<n;i++){const p=b.p[i],q=b.p[(i+1)%n];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;};
function inside(pt,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>pt[1])!=(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function segd(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1];let t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1);t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);}
function gap(A,B){let d=1e9;for(const [P,Q] of [[A,B],[B,A]])for(const p of P.p){if(inside(p,Q.p))return 0;for(let i=0;i<Q.p.length;i++)d=Math.min(d,segd(p,Q.p[i],Q.p[(i+1)%Q.p.length]));}return d;}
let hist={};let ov=0,close=0;const C=B.map(cen);
for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){if(Math.hypot(C[i][0]-C[j][0],C[i][1]-C[j][1])>60)continue;const g=gap(B[i],B[j]);if(g===0)ov++;else if(g<3)close++;}
console.log('overlapping pairs',ov,'pairs closer than 3 m',close);
const ar=B.map(area).sort((a,b)=>a-b);console.log('area median',ar[ar.length>>1],'p10',ar[ar.length/10|0],'p90',ar[ar.length*0.9|0]);
console.log('4-corner',B.filter(b=>b.p.length===4).length);
