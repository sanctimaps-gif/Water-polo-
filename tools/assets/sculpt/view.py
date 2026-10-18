import sys, json, numpy as np
from PIL import Image
def load_obj(p):
    V=[];F=[]
    for l in open(p,errors='ignore'):
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('f '):
            ids=[int(t.split('/')[0]) for t in l.split()[1:]]
            for k in range(1,len(ids)-1): F.append([ids[0],ids[k],ids[k+1]])
    V=np.array(V);F=np.array(F);F=np.where(F>0,F-1,F+len(V));return V,F
def load_gltf(p):
    g=json.load(open(p)); import os; b=open(os.path.join(os.path.dirname(p),g['buffers'][0]['uri']),'rb').read()
    def acc(i):
        a=g['accessors'][i]; bv=g['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        dt={5126:np.float32,5125:np.uint32,5123:np.uint16}[a['componentType']]; n={'SCALAR':1,'VEC3':3,'VEC2':2}[a['type']]
        st=bv.get('byteStride'); 
        if st and st!=n*np.dtype(dt).itemsize:
            raw=np.frombuffer(b,np.uint8,a['count']*st,off).reshape(a['count'],st); return np.frombuffer(raw[:,:n*np.dtype(dt).itemsize].tobytes(),dt).reshape(-1,n)
        return np.frombuffer(b,dt,a['count']*n,off).reshape(-1,n) if n>1 else np.frombuffer(b,dt,a['count'],off)
    Vs=[];Fs=[];o=0
    # node transforms ignored except root matrix (assume)
    for m in g['meshes']:
        for pr in m['primitives']:
            V=acc(pr['attributes']['POSITION']).astype(float); I=acc(pr['indices']).astype(int).reshape(-1,3)
            Vs.append(V);Fs.append(I+o);o+=len(V)
    return np.vstack(Vs),np.vstack(Fs)
def render(V,F,W=360,H=640):
    V=V-(V.max(0)+V.min(0))/2; s=H*0.47/max(np.abs(V[:,1]).max(),1e-9)
    X=V[:,0]*s+W/2; Y=H/2-V[:,1]*s; T=V[F]; n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]); n/=np.linalg.norm(n,axis=1)[:,None]+1e-12
    L=np.array([0.3,0.5,0.8]);L/=np.linalg.norm(L); sh=np.abs(n@L)*0.8+0.2
    zb=np.full((H,W),-1e18); img=np.zeros((H,W)); cz=T[:,:,2].mean(1)
    xi=np.clip(X[F].mean(1).astype(int),0,W-1); yi=np.clip(Y[F].mean(1).astype(int),0,H-1)
    o=np.argsort(cz)
    img[yi[o],xi[o]]=sh[o]
    return Image.fromarray((np.maximum(img,np.roll(img,1,0))*255).astype(np.uint8))
if __name__=="__main__":
    p=sys.argv[1]; V,F=(load_gltf(p) if p.endswith('gltf') else load_obj(p))
    print(p.split('/')[-1],'verts',len(V),'tris',len(F),'bbox',V.min(0).round(2),V.max(0).round(2))
    up=int(sys.argv[3]) if len(sys.argv)>3 else 1
    if up==2: V=np.stack([V[:,0],V[:,2],-V[:,1]],1)
    a=render(V,F); b=render(np.stack([V[:,2],V[:,1],-V[:,0]],1),F); c=render(np.stack([-V[:,0],V[:,1],-V[:,2]],1),F)
    o=Image.new('L',(1080,640)); o.paste(a,(0,0)); o.paste(b,(360,0)); o.paste(c,(720,0)); o.save(sys.argv[2])
