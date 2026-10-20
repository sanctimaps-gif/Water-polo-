import sys; sys.path.insert(0,'.')
import numpy as np, json
from bodyio import read
h,idx,P,*_=read(); MH=P['athletic']; JM=h['joints']['athletic']
d=np.load('dec_17160.npz'); V=d['V'].astype(float); F=d['F'].astype(int)
def width_profile(X,y,dy=0.01):
    m=np.abs(X[:,1]-y)<dy; return np.abs(X[m,0]).max() if m.any() else 0
# neck base: highest y where torso width > 0.15 (MH 0.17-ish rel sole 1.615)
def neck_base(X):
    ys=np.arange(X[:,1].max(),X[:,1].min(),-0.005)
    for y in ys:
        if width_profile(X,y)>0.15: return y
sole_s=V[:,1].min(); nb_s=neck_base(V); nb_m=neck_base(MH); sole_m=MH[:,1].min()
k=(nb_m-sole_m)/(nb_s-sole_s); print('neckbase',nb_s,nb_m,'scale',k)
V=(V-[0,sole_s,0])*k+[0,sole_m,0]
# z: match neck centre at y=0.19
def zc(X,y): m=(np.abs(X[:,1]-y)<0.01)&(np.abs(X[:,0])<0.07); return (X[m,2].min()+X[m,2].max())/2
dz=zc(MH,0.19)-zc(V,0.19); V[:,2]+=dz; print('dz',dz)
# cut the neck at MH's top (0.216): drop triangles fully above, clamp the rest
top=MH[:,1].max()
keep=~(V[F][:,:,1]>top+0.015).any(1); F=F[keep]
# neck tucked inside the scanned head's neck near the top (no shards under the chin)
ss=lambda a,b,x: (lambda t: t*t*(3-2*t))(np.clip((x-a)/(b-a),0,1))
zn=zc(V,0.19); k=1-0.0*ss(0.13,0.205,V[:,1])*(np.abs(V[:,0])<0.12)
V[:,0]*=k; V[:,2]=zn+(V[:,2]-zn)*k
used=np.unique(F); remap=-np.ones(len(V),int); remap[used]=np.arange(len(used)); V=V[used]; F=remap[F]
print('verts',len(V),'tris',len(F),'bbox',V.min(0).round(3),V.max(0).round(3))
np.savez('aligned.npz',V=V,F=F)
