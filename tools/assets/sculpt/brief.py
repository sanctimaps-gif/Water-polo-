import sys; sys.path.insert(0,'.')
import numpy as np, json, scipy.sparse as sp
d=np.load('aligned.npz'); V=d['V'].copy(); F=d['F']; jj=json.load(open('joints.json')); c=jj['crotch']; hz=jj['J']['l-upper-leg'][2]
nv=len(V); E=np.r_[F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]
A=sp.coo_matrix((np.ones(len(E)),(E[:,0],E[:,1])),shape=(nv,nv)); A=((A+A.T)>0).astype(float).tocsr(); deg=np.asarray(A.sum(1)).ravel(); L=sp.diags(1/np.maximum(deg,1))@A
ss=lambda a,b,x: (lambda t: t*t*(3-2*t))(np.clip((x-a)/(b-a),0,1))
ax=np.abs(V[:,0]); y=V[:,1]
# smooth weight: 1 in the core of the crotch / genital area, fading out
w=ss(0.10,0.06,ax)*ss(c-0.10,c-0.06,y)*ss(c+0.14,c+0.09,y)*ss(hz-0.06,hz-0.02,V[:,2])
X=V.copy()
for _ in range(120): X=X+(L@X-X)*0.6*w[:,None]
g=np.exp(-(X[:,0]/0.045)**2-((X[:,1]-(c+0.035))/0.045)**2)*w; X[:,2]+=0.014*g
np.savez('aligned_brief.npz',V=X,F=F); print('moved',np.linalg.norm(X-V,axis=1).max())
