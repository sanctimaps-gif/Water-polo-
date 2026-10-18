import sys; sys.path.insert(0,'.')
import numpy as np, json
from bodyio import read
h,_,_,*_=read(); JM=h['joints']['athletic']
d=np.load('aligned.npz'); V=d['V']; F=d['F']
def slice_(y,dy=0.008): return V[np.abs(V[:,1]-y)<dy]
# torso half-width per y (connected from x=0): walk out in x bins until a gap
def torso_w(y):
    s=slice_(y,0.01); ax=np.sort(np.abs(s[:,0]))
    if len(ax)==0: return 0
    gaps=np.where(np.diff(ax)>0.012)[0]
    return ax[gaps[0]] if len(gaps) else ax[-1]
ys=np.arange(V[:,1].max(),V[:,1].min(),-0.01)
# crotch: highest y where no vertex near x=0 (legs separated)
crotch=None
for y in np.arange(0.0,-1.0,-0.005):
    s=slice_(y,0.004)
    if len(s) and not (np.abs(s[:,0])<0.012).any(): crotch=y; break
print('crotch',crotch)
# arm vertices: |x| beyond the torso width with a gap, above the crotch-ish (hands reach thigh level)
arm=np.zeros(len(V),bool)
for y in np.arange(0.12,-0.75,-0.01):
    m=np.abs(V[:,1]-y)<0.005; s=V[m]; ax=np.abs(s[:,0])
    if y<-0.3: arm[np.where(m)[0][ax>0.27]]=True; continue
    o=np.argsort(ax); axs=ax[o]; gaps=np.where(np.diff(axs)>0.012)[0]
    if len(gaps)==0: continue
    thr=axs[gaps[-1]]+0.006  # outermost gap: arm lies beyond
    if y < crotch+0.05:   # legs region: arm is beyond the leg too
        pass
    lim=0.27 if y<-0.3 else 0
    idxs=np.where(m)[0][(ax>thr)&(ax>lim)]; arm[idxs]=True
armL=arm&(V[:,0]>0)
A=V[armL]; print('arm verts',len(A), 'y',A[:,1].min(),A[:,1].max())
tip=A[np.argmin(A[:,1])]
# centreline: centroids of slices along y
cl=[]
for y in np.arange(A[:,1].max()-0.01,A[:,1].min(),-0.02):
    s=A[np.abs(A[:,1]-y)<0.01]
    if len(s)>5: cl.append(s.mean(0))
cl=np.array(cl)
up=cl[cl[:,1]>cl[0,1]-0.2]; dirv=np.polyfit(up[:,1],up[:,0],1); dirz=np.polyfit(up[:,1],up[:,2],1)
nb=0.146; shy=JM['l-shoulder'][1]  # same shoulder height as the game rig
so=V[np.abs(V[:,1]-shy)<0.008]; sh=np.array([np.abs(so[:,0]).max()-0.062,shy,np.polyval(dirz,shy)])
wr=tip+ (np.array([0,0.17,0]) if True else 0); 
# wrist: point on centreline 0.18 above tip along the arm
seg=cl[-1]-cl[-6]; wr=tip-0.185*(tip-cl[-8])/np.linalg.norm(tip-cl[-8])
s=A[np.abs(A[:,1]-wr[1])<0.008]; wr=s.mean(0)
el=sh+(wr-sh)*0.5; s=A[np.abs(A[:,1]-el[1])<0.01]; el=s.mean(0)
hand=A[(A[:,1]<wr[1])]
m1=wr+(tip-wr)*0.52; s=hand[np.abs(hand[:,1]-m1[1])<0.01]; m1=s.mean(0) if len(s) else m1
up_h=hand[hand[:,1]>wr[1]-(wr[1]-tip[1])*0.55]
th=up_h[np.argmax(up_h[:,2])]; lf=up_h[np.argmin(up_h[:,2])]
# legs
hipy=crotch+0.085; s=slice_(crotch-0.03,0.008); s=s[(s[:,0]>0)&(~arm[np.abs(V[:,1]-(crotch-0.03))<0.008][s[:,0]>0] if False else True)]
s=V[(np.abs(V[:,1]-(crotch-0.03))<0.008)&(V[:,0]>0)&(~arm)]
hip=np.array([s[:,0].mean(),hipy,s[:,2].mean()])
sole=V[:,1].min(); an_y=sole+0.075
s=V[(np.abs(V[:,1]-an_y)<0.008)&(V[:,0]>0)]; heel=s[:,2].min(); s=s[s[:,2]<heel+0.09]; an=s.mean(0)
kn_y=hip[1]+(an[1]-hip[1])*0.49; s=V[(np.abs(V[:,1]-kn_y)<0.008)&(V[:,0]>0)&(~arm)]; kn=s.mean(0)
J={k:JM[k] for k in ['neck','head','headBone']}
def put(n,p): J['l-'+n]=[round(float(x),5) for x in p]; q=p.copy(); q[0]=-q[0]; J['r-'+n]=[round(float(x),5) for x in q]
put('shoulder',sh); put('elbow',el); put('hand',wr); put('upper-leg',hip); put('knee',kn); put('ankle',an)
put('finger-3-1',m1); put('finger-1-2',th); put('finger-5-1',lf); put('finger-3-4',tip)
json.dump({'J':J,'crotch':float(crotch),'arm':arm.tolist()},open('joints.json','w'))
for k,v in J.items(): print(k,v)
# overlay render
from PIL import Image, ImageDraw
from view import render
im=render(V,F).convert('RGB'); W,H=im.size; Vc=V-(V.max(0)+V.min(0))/2; s_=H*0.47/np.abs(Vc[:,1]).max(); c=(V.max(0)+V.min(0))/2
dr=ImageDraw.Draw(im)
for k,p in J.items():
    x=(p[0]-c[0])*s_+W/2; y=H/2-(p[1]-c[1])*s_; dr.ellipse([x-3,y-3,x+3,y+3],fill=(255,0,0))
im2=render(np.stack([V[:,2],V[:,1],-V[:,0]],1),F).convert('RGB'); dr2=ImageDraw.Draw(im2)
for k,p in J.items():
    if k.startswith('r-'): continue
    x=(p[2]-c[2])*s_+W/2; y=H/2-(p[1]-c[1])*s_; dr2.ellipse([x-3,y-3,x+3,y+3],fill=(255,0,0))
o=Image.new('RGB',(W*2,H)); o.paste(im,(0,0)); o.paste(im2,(W,0)); o.save('joints.png')
