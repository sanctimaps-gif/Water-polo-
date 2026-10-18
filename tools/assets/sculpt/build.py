import sys; sys.path.insert(0,'.')
import numpy as np, json
from bodyio import read
h0,*_=read()
d=np.load('aligned_brief.npz'); V=d['V']; F=d['F']; nv=len(V)
jj=json.load(open('joints.json')); J={k:np.array(v,float) for k,v in jj['J'].items()}; armMask=np.array(jj['arm']); crotch=jj['crotch']
ss=lambda a,b,x: (lambda t: t*t*(3-2*t))(np.clip((x-a)/(b-a),0,1))
BONES=['torso','head','shL','elL','wrL','shR','elR','wrR','hipL','knL','hipR','knR','smL','smR','chest']
# adjacency
import scipy.sparse as sp
E=np.r_[F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]; Adj=sp.coo_matrix((np.ones(len(E)),(E[:,0],E[:,1])),shape=(nv,nv)); Adj=((Adj+Adj.T)>0).astype(float).tocsr()
deg=np.asarray(Adj.sum(1)).ravel(); Lap=sp.diags(1/np.maximum(deg,1))@Adj
def smooth(X,it,a=0.5):
    for _ in range(it): X=X*(1-a)+(Lap@X)*a
    return X
armS=smooth(armMask.astype(float)[:,None],3)[:,0]
W=np.zeros((nv,len(BONES))); bi=BONES.index
neckY=J['neck'][1]; CUT=0.216; legY=J['l-upper-leg'][1]
for k in range(nv):
    p=V[k]; side=1 if p[0]>=0 else -1; c='l' if side>0 else 'r'; tag='L' if side>0 else 'R'
    sh,el,wr,hip,kn=J[c+'-shoulder'],J[c+'-elbow'],J[c+'-hand'],J[c+'-upper-leg'],J[c+'-knee']; tip=J[c+'-finger-3-4']
    ua=el-sh; Lua=np.linalg.norm(ua); ua/=Lua; t=np.dot(p-sh,ua)
    fa=wr-el; Lfa=np.linalg.norm(fa); fa/=Lfa; t2=np.dot(p-el,fa)
    def segD(a,b):
        ab=b-a; tt=np.clip(np.dot(p-a,ab)/np.dot(ab,ab),0,1); return np.linalg.norm(p-(a+ab*tt))
    dArm=min(segD(sh,el),segD(el,wr),segD(wr,tip+(tip-wr)*0.4))
    shx=abs(sh[0])
    armness=max(ss(0.115,0.077,dArm)*ss(0.093,0.143,abs(p[0])), ss(shx+0.016,shx+0.066,abs(p[0])))*ss(0.0,0.06,p[1]-(neckY-0.25)+0.3) 
    armness=max(armness*ss(legY+0.03,legY+0.09,p[1]), armS[k])
    infl={'torso':1.0}
    if armness>0.001:
        wSm=ss(-0.071,0.016,t); wSh=ss(-0.016,0.082,t); wEl=ss(-0.033,0.033,t-Lua); wWr=ss(-0.016,0.027,t2-Lfa); A=armness
        infl['torso']=1-wSm*A; infl['sm'+tag]=A*wSm*(1-wSh); infl['sh'+tag]=A*wSm*wSh*(1-wEl); infl['el'+tag]=A*wSm*wSh*wEl*(1-wWr); infl['wr'+tag]=A*wSm*wSh*wEl*wWr
    elif p[1]<legY+0.12 and abs(p[0])>0.004:
        wLeg=ss(legY+0.1,legY-0.04,p[1]+0.35*max(0,0.143-abs(p[0])))
        kd=kn-hip; Lth=np.linalg.norm(kd); kd/=Lth; tk=np.dot(p-hip,kd); wKn=ss(-0.049,0.038,tk-Lth)
        infl['torso']=1-wLeg; infl['hip'+tag]=wLeg*(1-wKn); infl['kn'+tag]=wLeg*wKn
    elif p[1]>neckY:
        wH=ss(neckY-0.011,CUT-0.002,p[1]); infl['torso']=1-wH; infl['head']=wH
    if infl.get('torso'):
        cc=ss(legY+0.15,legY+0.33,p[1]); infl['chest']=infl.get('chest',0)+infl['torso']*cc; infl['torso']*=1-cc
    for n,w in infl.items(): W[k,bi(n)]=w
W=smooth(W,2,0.4)
o=np.argsort(-W,1)[:,:4]; w4=np.take_along_axis(W,o,1); w4=np.where(w4>0.002,w4,0); w4/=w4.sum(1,keepdims=True)
b4=np.where(w4>0,o,0).astype(np.uint8)
# suit (briefs)
zc=(V[:,2].min()+V[:,2].max())/2
ax=np.abs(V[:,0]); y=V[:,1]; front=V[:,2]>J['l-upper-leg'][2]
waist=crotch+0.19-np.where(front,0.035,0)-0.02*ss(0.04,0.16,ax)
leg=crotch-0.025+0.11*ss(0.03,0.16,ax)+np.where(~front,-0.065,0)
inside=(y<waist)&(y>leg)&(armS<0.5)&(ax<0.25)
trim=inside&((y>waist-0.016)|(y<leg+0.012))
suit=np.where(inside,np.where(trim,200,255),0).astype(np.uint8)
# normals / AO
def vnorm(P):
    n=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]]); N=np.zeros_like(P)
    for i in range(3): np.add.at(N,F[:,i],n)
    return N/np.maximum(np.linalg.norm(N,axis=1,keepdims=True),1e-12)
N=vnorm(V); S1=smooth(V,2); S8=smooth(V,10)
c1=((S1-V)*N).sum(1); c8=((S8-V)*N).sum(1)
ao=np.round(255*np.clip(1-c1*3.0/0.1098-c8*0.9/0.1098,0.45,1)).astype(np.uint8)
# builds: scale away from the dominant bone axis
dom=np.argmax(W,1)
def axis_pt(k):
    n=BONES[dom[k]]; p=V[k]; c='l' if p[0]>=0 else 'r'
    seg={'sh':(c+'-shoulder',c+'-elbow'),'sm':(c+'-shoulder',c+'-elbow'),'el':(c+'-elbow',c+'-hand'),'wr':(c+'-hand',c+'-finger-3-4'),'hip':(c+'-upper-leg',c+'-knee'),'kn':(c+'-knee',c+'-ankle')}.get(n[:-1] if n[-1] in 'LR' else n)
    if seg is None: return np.array([0,p[1],J['l-upper-leg'][2]+0.0]) if n!='head' else None
    a,b=J[seg[0]],J[seg[1]]; ab=b-a; tt=np.clip(np.dot(p-a,ab)/np.dot(ab,ab),0,1); return a+ab*tt
AX=np.array([axis_pt(k) if axis_pt(k) is not None else V[k] for k in range(nv)])
K={'lean':0.93,'athletic':1.0,'power':1.045,'massive':1.09}
var={}
for n,kf in K.items():
    P=AX+(V-AX)*kf
    var[n]=P
joints_out={n:{k:[round(float(x),5) for x in v] for k,v in J.items()} for n in K}
hdr={'suitRef':{'hipY':round(float(legY),5),'S':h0['suitRef']['S'],'OZ':h0['suitRef']['OZ']},'nv':nv,'ni':int(F.size),'variants':list(K),'bones':BONES,'joints':joints_out,'sculpt':True,
 'source':'"Male body" by Chin Eeyang (Sketchfab), CC BY 4.0 — decimated, aligned to the game rig, skinned'}
idx=F.astype(np.uint16).ravel(); buf=idx.tobytes(); buf+=b'\0'*((4-len(buf)%4)%4)
for n in K: buf+=var[n].astype(np.float32).tobytes()
buf+=b4.tobytes()+w4.astype(np.float32).tobytes()+suit.tobytes()+ao.tobytes()
R='web/assets/body/'
open(R+'body.bin','wb').write(buf); json.dump(hdr,open(R+'body.json','w'))
print('nv',nv,'tris',len(F),'bytes',len(buf),'suit',int((suit>0).sum()))
# --- decal anchors on the suit (number on the left hip front, side stripes, curved back badge)
A=var['athletic']; Nn=vnorm(A); suitV=suit>0
top=float(np.percentile(A[suitV&(A[:,2]>J['l-upper-leg'][2]),1],95))   # front waistband height
def near(x,y,z_sign,r=0.012):
    m=(np.abs(A[:,0]-x)<r)&(np.abs(A[:,1]-y)<r)
    if z_sign!=0: m&=np.sign(A[:,2]-J['l-upper-leg'][2])==z_sign
    i=np.where(m)[0]; k=i[np.argmax(A[i,2]*z_sign)] if z_sign else i[0]; return A[k],Nn[k]
ny=top-0.045
pn,nn=near(-0.1,ny,1)
# side: widest point of the suit at ny
m=suitV&(np.abs(A[:,1]-ny)<0.01); i=np.where(m&(A[:,0]>0))[0]; k=i[np.argmax(A[i,0])]; ps,ns=A[k],Nn[k]
# back: circle fit of the back slice (|x|<0.11) at the badge height
by=top-0.02; m=(np.abs(A[:,1]-by)<0.006)&(np.abs(A[:,0])<0.11)&(A[:,2]<J['l-upper-leg'][2]); B=A[m]
# fit circle in xz: x^2+z^2+Dx+Ez+F=0
M=np.c_[B[:,0],B[:,2],np.ones(len(B))]; rhs=-(B[:,0]**2+B[:,2]**2); D,Ez,Fc=np.linalg.lstsq(M,rhs,rcond=None)[0]
cz=-Ez/2; rad=float(np.sqrt(D*D/4+Ez*Ez/4-Fc)); rad=min(max(rad,0.09),0.2)
cz=float(B[:,2].min()+rad)
hdr['decals']={'number':{'p':[round(float(x),4) for x in pn+nn*0.002],'n':[round(float(x),4) for x in nn]},'stripe':{'p':[round(float(x),4) for x in ps+ns*0.002],'n':[round(float(x),4) for x in ns]},'back':{'y':round(by,4),'z':round(cz,4),'r':round(rad+0.002,4)}}
json.dump(hdr,open(R+'body.json','w')); print('decals',hdr['decals'],'waist top',top)
