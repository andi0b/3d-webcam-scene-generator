import * as THREE from 'three';
import { roundedBox } from '../primitives.js';

export function createRollup() {
  const stand = new THREE.Group();
  stand.name = 'roomlight-rollup';
  const metal = new THREE.MeshStandardMaterial({color:'#bfc3c2',metalness:.62,roughness:.36});
  const rubber = new THREE.MeshStandardMaterial({color:'#363a39',roughness:.89});
  for (const x of [-.29,.29]) roundedBox(stand,[.048,.016,.32],[x,.008,.012],metal,.006,1);
  roundedBox(stand,[.93,.081,.142],[0,.054,0],metal,.031,2);
  for (const side of [-1,1]) roundedBox(stand,[.013,.082,.145],[side*.465,.054,0],rubber,.006,1);
  roundedBox(stand,[.853,.005,.018],[0,.094,.022],rubber,.002,1);
  const extended = new THREE.Group();
  stand.add(extended);
  const width=.84, height=1.96;
  const panel=new THREE.PlaneGeometry(width,height,6,4);
  const p=panel.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i)/(width/2), t=p.getY(i)/height+.5;
    p.setZ(i,.022 + .009*(1-x*x)*Math.sin(Math.PI*t));
  }
  panel.translate(0,.094+height/2,0);
  panel.computeVertexNormals();
  const face=new THREE.Mesh(panel,new THREE.MeshStandardMaterial({roughness:.89}));
  face.castShadow=face.receiveShadow=true;
  const back=new THREE.Mesh(panel,new THREE.MeshStandardMaterial({color:'#d6d3c7',roughness:.94,side:THREE.BackSide}));
  back.position.z=-.001; back.receiveShadow=true;
  extended.add(face,back);
  roundedBox(extended,[.865,.022,.027],[0,.094+height,.019],metal,.005,1);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.006,.009,height,10),metal);
  mast.position.set(0,.094+height/2,-.042);
  extended.add(mast);
  roundedBox(extended,[.024,.019,.076],[0,.094+height,-.011],rubber,.003,1);
  stand.userData.extended = extended;
  stand.userData.face = face;
  return stand;
}
