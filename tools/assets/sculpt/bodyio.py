import json, numpy as np
R='web/assets/body/'
def read():
    h=json.load(open('./body_mh.json')); b=open('./body_mh.bin','rb').read(); nv,ni=h['nv'],h['ni']; o=0
    idx=np.frombuffer(b,np.uint16,ni,o).astype(int).reshape(-1,3); o+=ni*2; o+=(4-o%4)%4
    P={}
    for v in h['variants']: P[v]=np.frombuffer(b,np.float32,nv*3,o).reshape(-1,3).astype(float); o+=nv*12
    b4=np.frombuffer(b,np.uint8,nv*4,o).reshape(-1,4); o+=nv*4
    w4=np.frombuffer(b,np.float32,nv*4,o).reshape(-1,4); o+=nv*16
    suit=np.frombuffer(b,np.uint8,nv,o); o+=nv; ao=np.frombuffer(b,np.uint8,nv,o); o+=nv
    assert o==len(b),(o,len(b))
    return h,idx,P,b4.copy(),w4.copy(),suit.copy(),ao.copy()
