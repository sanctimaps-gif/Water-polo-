import sys; sys.path.insert(0,'.')
import numpy as np, json, os
from view import load_gltf
def load():
    c='./sculpt.npz'
    if os.path.exists(c): d=np.load(c); return d['V'],d['F']
    V,F=load_gltf('./in2/794a4355-male_body/scene.gltf')
    V=np.stack([V[:,0],V[:,2],-V[:,1]],1)/100.0
    np.savez(c,V=V,F=F); return V,F
