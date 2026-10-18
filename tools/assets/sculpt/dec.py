import sys; sys.path.insert(0,'.')
import numpy as np, fast_simplification as fs, time
from sculpt import load
V,F=load()
t=time.time()
q=np.round(V/1e-5).astype(np.int64); _,first,inv=np.unique(q,axis=0,return_index=True,return_inverse=True)
inv=inv.reshape(-1); V2=V[first]; F2=inv[F]
F2=F2[(F2[:,0]!=F2[:,1])&(F2[:,1]!=F2[:,2])&(F2[:,0]!=F2[:,2])]
print('welded',len(V),'->',len(V2),'tris',len(F2),time.time()-t)
# connected components
import scipy.sparse as sp
from scipy.sparse.csgraph import connected_components
n=len(V2); A=sp.coo_matrix((np.ones(len(F2)*3),(np.r_[F2[:,0],F2[:,1],F2[:,2]],np.r_[F2[:,1],F2[:,2],F2[:,0]])),shape=(n,n))
nc,lab=connected_components(A,directed=False); cnt=np.bincount(lab); print('components',nc,sorted(cnt)[-5:])
for target in [0.985,0.975]:
    Vd,Fd=fs.simplify(V2.astype(np.float32),F2.astype(np.int32),target_reduction=target)
    print(target,len(Vd),len(Fd),time.time()-t)
    np.savez(f'dec_{len(Vd)}.npz',V=Vd,F=Fd)
