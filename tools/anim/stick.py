import json,sys
from PIL import Image, ImageDraw
d=json.load(open(sys.argv[1])); F=d['frames']
E=[('Hips','Spine'),('Spine','Spine2'),('Spine2','Neck'),('Neck','Head'),('Head','HeadTop_End'),('Spine2','LeftArm'),('LeftArm','LeftForeArm'),('LeftForeArm','LeftHand'),('Spine2','RightArm'),('RightArm','RightForeArm'),('RightForeArm','RightHand'),('Hips','LeftUpLeg'),('LeftUpLeg','LeftLeg'),('LeftLeg','LeftFoot'),('LeftFoot','LeftToeBase'),('Hips','RightUpLeg'),('RightUpLeg','RightLeg'),('RightLeg','RightFoot'),('RightFoot','RightToeBase')]
idx=list(range(0,len(F),8))[:12]
W=170;H=200
img=Image.new('RGB',(W*len(idx),H*2),'white'); dr=ImageDraw.Draw(img)
for c,i in enumerate(idx):
  f=F[i]
  for row,(ax,sgn) in enumerate([(0,1),(2,1)]):  # front view (x,y), side view (z,y)
    def P(k): p=f[k]; return (c*W+W/2+sgn*p[ax]*0.9, row*H+H-10-p[1]*1.1+20)
    for a,b in E:
      col='red' if 'Left' in b else 'blue' if 'Right' in b else 'black'
      dr.line([P(a),P(b)],fill=col,width=3)
  dr.text((c*W+5,5),str(i),fill='black')
dr.line([(0,H-10-100*1.1+20+ -30),(W*len(idx),H-10-100*1.1+20-30)],fill='cyan')
img.save(sys.argv[2])
