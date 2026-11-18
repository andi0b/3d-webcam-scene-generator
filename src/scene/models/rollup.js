import * as THREE from 'three';
import { roundedBox } from '../primitives.js';

function studioPrint() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 1152;
  const ctx = canvas.getContext('2d');
  const cream = '#f4efdc', pine = '#203e37', gold = '#e9b558';
  ctx.fillStyle = pine;
  ctx.fillRect(0,0,512,1152);
  ctx.fillStyle = cream;
  ctx.font = 'bold 82px Georgia';
  ctx.fillText('Roomlit',38,128);
  ctx.fillText('Studio',38,212);
  // A sunlit arched window and its long cast shadow form the campaign motif.
  ctx.save();
  ctx.beginPath(); ctx.rect(0,294,512,570); ctx.clip();
  ctx.fillStyle = '#879b83'; ctx.fillRect(0,294,512,570);
  ctx.fillStyle = '#d0bd91';
  ctx.beginPath(); ctx.moveTo(0,742); ctx.lineTo(512,635); ctx.lineTo(512,864); ctx.lineTo(0,864); ctx.fill();
  ctx.fillStyle = pine;
  ctx.beginPath(); ctx.moveTo(112,686); ctx.lineTo(112,502);
  ctx.arc(256,502,144,Math.PI,0); ctx.lineTo(400,686); ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(309,493,65,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#668575'; ctx.beginPath(); ctx.moveTo(78,656);
  ctx.quadraticCurveTo(193,490,312,600); ctx.lineTo(430,552); ctx.lineTo(430,700); ctx.lineTo(78,700); ctx.fill();
  ctx.fillStyle = cream; ctx.fillRect(247,345,13,355); ctx.fillRect(104,545,304,11);
  ctx.restore();
  ctx.fillStyle = '#fae2a0';
  ctx.beginPath(); ctx.moveTo(112,686); ctx.lineTo(400,686); ctx.lineTo(203,864); ctx.lineTo(-87,864); ctx.fill();
  ctx.fillStyle = '#a99a75'; ctx.beginPath(); ctx.moveTo(247,686); ctx.lineTo(260,686);
  ctx.lineTo(63,864); ctx.lineTo(50,864); ctx.fill();
  ctx.restore();
  ctx.fillStyle = cream; ctx.font = 'bold 46px Arial';
  ctx.fillText('A room of',38,963); ctx.fillText('your own.',38,1016);
  ctx.fillStyle = gold; ctx.fillRect(40,1061,62,3);
  ctx.fillStyle = cream; ctx.font = '22px Arial'; ctx.fillText('Virtual backgrounds',38,1112);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createRollup(print = studioPrint()) {
  const stand = new THREE.Group();
  stand.name = 'roomlit-studio-rollup';
  const metal = new THREE.MeshStandardMaterial({color:'#bfc3c2',metalness:.62,roughness:.36});
  const rubber = new THREE.MeshStandardMaterial({color:'#363a39',roughness:.89});
  for (const x of [-.29,.29]) roundedBox(stand,[.048,.016,.32],[x,.008,.012],metal,.006,1);
  roundedBox(stand,[.93,.081,.142],[0,.054,0],metal,.031,2);
  for (const side of [-1,1]) roundedBox(stand,[.013,.082,.145],[side*.465,.054,0],rubber,.006,1);
  roundedBox(stand,[.853,.005,.018],[0,.094,.022],rubber,.002,1);
  const width=.84, height=1.96;
  const panel=new THREE.PlaneGeometry(width,height,6,4);
  const p=panel.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i)/(width/2), t=p.getY(i)/height+.5;
    p.setZ(i,.022 + .009*(1-x*x)*Math.sin(Math.PI*t));
  }
  panel.translate(0,.094+height/2,0);
  panel.computeVertexNormals();
  const face=new THREE.Mesh(panel,new THREE.MeshStandardMaterial({map:print,roughness:.89}));
  face.castShadow=face.receiveShadow=true;
  const back=new THREE.Mesh(panel,new THREE.MeshStandardMaterial({color:'#d6d3c7',roughness:.94,side:THREE.BackSide}));
  back.position.z=-.001; back.receiveShadow=true;
  stand.add(face,back);
  roundedBox(stand,[.865,.022,.027],[0,.094+height,.019],metal,.005,1);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.006,.009,height,10),metal);
  mast.position.set(0,.094+height/2,-.042);
  stand.add(mast);
  roundedBox(stand,[.024,.019,.076],[0,.094+height,-.011],rubber,.003,1);
  return stand;
}
