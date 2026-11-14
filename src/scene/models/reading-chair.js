import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createNormalTexture } from '../../surface-normals.js';
import { roundedBox } from '../primitives.js';
import { createBirchFinish } from '../surface-textures.js';

function createChairPart(geometry, materials) {
  // The path-tracer merger expects one material per mesh. Keep the original
  // face ranges and their normals and UVs in separate meshes.
  const part = new THREE.Group();
  for (const { start, count, materialIndex } of geometry.groups) {
    const surface = new THREE.BufferGeometry();
    let firstVertex = start;
    let vertexCount = count;
    if (geometry.index) {
      const indices = geometry.index.array.slice(start, start + count);
      firstVertex = Infinity;
      let lastVertex = 0;
      for (const index of indices) {
        firstVertex = Math.min(firstVertex, index);
        lastVertex = Math.max(lastVertex, index);
      }
      vertexCount = lastVertex - firstVertex + 1;
      surface.setIndex(new THREE.BufferAttribute(indices.map(index => index - firstVertex), 1));
    }
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const { array, itemSize, normalized } = attribute;
      const values = array.slice(firstVertex * itemSize, (firstVertex + vertexCount) * itemSize);
      surface.setAttribute(name, new THREE.BufferAttribute(values, itemSize, normalized));
    }
    const mesh = new THREE.Mesh(surface, materials[materialIndex]);
    mesh.castShadow = mesh.receiveShadow = true;
    part.add(mesh);
  }
  return part;
}

export function createReadingChair(birch = createBirchFinish()) {
  const chair = new THREE.Group();
  chair.name = 'reading-chair';
  // Scale the model to the reference chair's 68 × 82 × 100 cm overall dimensions.
  chair.scale.set(.80,.85,.85);
  // Exposed edges of the bentwood show the fine layers of the veneer stack.
  const laminateCanvas=document.createElement('canvas'); laminateCanvas.width=128; laminateCanvas.height=128;
  const laminateCtx=laminateCanvas.getContext('2d'); laminateCtx.fillStyle='#e5d8b5'; laminateCtx.fillRect(0,0,128,128);
  for(let y=4;y<128;y+=14) {
    laminateCtx.fillStyle='rgba(135,110,75,.12)'; laminateCtx.fillRect(0,y,128,1);
    laminateCtx.fillStyle='rgba(255,250,228,.18)'; laminateCtx.fillRect(0,y+2,128,2);
  }
  const laminateMap=new THREE.CanvasTexture(laminateCanvas); laminateMap.colorSpace=THREE.SRGBColorSpace;
  laminateMap.wrapS=laminateMap.wrapT=THREE.RepeatWrapping; laminateMap.repeat.set(1,12);
  const laminate = birch.clone();
  laminate.map = laminateMap;
  const weave = createNormalTexture(128, 128, (x, y) =>
    .25 * (Math.cos(x * Math.PI / 4) + Math.cos(y * Math.PI / 4)) +
    .125 * Math.cos((x + y) * Math.PI / 8), .22);
  weave.repeat.set(3, 4);
  const clothCanvas=document.createElement('canvas'); clothCanvas.width=256; clothCanvas.height=1024;
  const clothCtx=clothCanvas.getContext('2d'), clothPixels=clothCtx.createImageData(256,1024);
  for(let y=0;y<1024;y++) for(let x=0;x<256;x++) {
    const noise=((x*37+y*73+x*y*11)%13)-6, thread=(x%4===0?-3:0)+(y%4===0?-3:0);
    const value=248+noise+thread, i=(y*256+x)*4;
    clothPixels.data[i]=value; clothPixels.data[i+1]=value; clothPixels.data[i+2]=value; clothPixels.data[i+3]=255;
  }
  clothCtx.putImageData(clothPixels,0,0);
  // Very fine, slightly curved stitching remains visible under diffuse light.
  function stitch(t,opacity) {
    const y=(1-t)*1024; clothCtx.strokeStyle=`rgba(85,82,78,${opacity})`; clothCtx.lineWidth=1;
    clothCtx.beginPath(); clothCtx.moveTo(5,y); clothCtx.quadraticCurveTo(128,y+1.4,251,y); clothCtx.stroke();
  }
  for(let i=0;i<=18;i++) stitch(.50+i*.019,.22);
  for(let i=0;i<=5;i++) stitch(.035+i*.045,.12);
  const clothMap=new THREE.CanvasTexture(clothCanvas); clothMap.colorSpace=THREE.SRGBColorSpace;
  clothMap.wrapS=clothMap.wrapT=THREE.RepeatWrapping;
  const fabric = new THREE.MeshPhysicalMaterial({ color: '#999894', map:clothMap, roughness: 1, sheen: .18, sheenColor: '#c1bfb9', sheenRoughness: 1, normalMap: weave, side: THREE.DoubleSide });
  // Avoid stretching a single row of the surface texture around the rolled edges.
  const edgeFabric=fabric.clone(); edgeFabric.map=null; edgeFabric.normalMap=null;
  // The photographed chair has a lighter woven backing on the reverse.
  const backing = fabric.clone(); backing.color.set('#c8c6bf'); backing.map=null; backing.sheen = .25;
  const metal = new THREE.MeshStandardMaterial({ color: '#b9bab5', metalness: .35, roughness: .48 });

  // Flat, continuously bent side frames form the floor runners and arms.
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(.43,.035); shape.lineTo(-.33,.035);
    shape.quadraticCurveTo(-.39,.035,-.39,.12); shape.lineTo(-.39,.52);
    shape.quadraticCurveTo(-.39,.595,-.32,.615); shape.lineTo(.18,.67);
    shape.bezierCurveTo(.30,.685,.36,.71,.425,.775);
    shape.quadraticCurveTo(.445,.79,.45,.77);
    shape.bezierCurveTo(.41,.71,.35,.66,.18,.64); shape.lineTo(-.31,.585);
    shape.quadraticCurveTo(-.36,.575,-.36,.51); shape.lineTo(-.36,.14);
    shape.quadraticCurveTo(-.36,.065,-.31,.065); shape.lineTo(.43,.065); shape.closePath();
    const frame = createChairPart(new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelSize: .006, bevelThickness: .003, bevelSegments: 3, curveSegments: 20 }), [birch,laminate]);
    frame.name = `chair-arm-${side}`;
    frame.rotation.y = Math.PI / 2; frame.position.x = side * .39 - .035; chair.add(frame);
  }

  // One continuous, gently curved upholstered seat and tall reclining back.
  const profile = [[.36,.47],[.25,.46],[.08,.455],[-.10,.46],[-.24,.48],[-.30,.53],[-.33,.60],[-.38,.71],[-.43,.83],[-.48,.96],[-.50,1.07],[-.50,1.16]];
  const curve = new THREE.CatmullRomCurve3(profile.map(([z,y]) => new THREE.Vector3(0,y,z)), false, 'centripetal');
  const cushionHalfWidth = t => {
    const front=Math.min(1,t/.035), head=Math.min(1,(1-t)/.045);
    return .350-.008*(1-Math.sqrt(Math.max(0,front)))-.020*(1-Math.sqrt(Math.max(0,head)));
  };
  const geometry = new THREE.BufferGeometry(), vertices = [], uvs = [], indices = [], rows = 288, cols = 48;
  const layerSize=(rows+1)*(cols+1);
  for (let layer=0; layer<2; layer++) for (let j=0; j<=rows; j++) {
    const t=j/rows, point=curve.getPointAt(t), tangent=curve.getTangentAt(t);
    // Taper the corners at the head and seat front, with a full cushioned center.
    const width=cushionHalfWidth(t);
    for (let i=0; i<=cols; i++) {
      const u=i/cols, across=Math.abs(2*u-1), round=Math.sqrt(Math.max(0,1-Math.pow(across,8)));
      // Narrow recessed seams form the horizontal padded channels. Fade them at the edges.
      // The stitching has a very slight sag across the cushion rather than a
      // perfectly rigid, machine-straight profile.
      const channel=(t-.50+.0014*(1-across*across))/.019;
      const nearest=Math.round(channel), distance=Math.abs(channel-nearest);
      const backRib=nearest>=0 && nearest<=18 ? -.00065*Math.exp(-distance*distance*34) : 0;
      const seatChannel=(t-.035)/.045, seatNearest=Math.round(seatChannel);
      const seatRib=seatNearest>=0 && seatNearest<=5 ? -.0009*Math.exp(-Math.pow(seatChannel-seatNearest,2)*32) : 0;
      const rib=layer===0 ? (backRib+seatRib)*round : 0;
      const edgeWrinkle=layer===0 ? .0016*Math.sin(t*105+u*19)*Math.pow(across,5)*Math.sin(Math.PI*t) : 0;
      const seatDip=layer===0 && t<.48 ? -.010*(1-across*across)*Math.pow(Math.sin(Math.PI*t/.48),2) : 0;
      // A few shallow, asymmetric creases gather where the upholstery turns
      // around the front corners and the upper edge of the headrest.
      const edgeGather=Math.exp(-Math.pow((across-.84)/.12,2));
      const creaseCenter=(u<.5?.065:.105)+.035*(1-across);
      const seatCrease=layer===0 ? -.0025*edgeGather*Math.exp(-Math.pow((t-creaseCenter)/.018,2)) : 0;
      const headCrease=layer===0 ? -.0012*edgeGather*Math.exp(-Math.pow((t-.94)/.023,2)) : 0;
      const thickness=(layer===0 ? .037 : -.029)*round + rib + edgeWrinkle*round + seatDip + seatCrease + headCrease;
      vertices.push((2*u-1)*width,point.y-tangent.z*thickness,point.z+tangent.y*thickness); uvs.push(u,t);
      if (j<rows && i<cols) {
        const a=layer*layerSize+j*(cols+1)+i, b=a+cols+1;
        if (layer===0) indices.push(a,a+1,b,b,a+1,b+1); else indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  // Roll the ends over rather than closing the cushion with a flat cut face.
  for (const endT of [0,1]) {
    const point=curve.getPointAt(endT), tangent=curve.getTangentAt(endT), start=vertices.length/3, steps=12;
    for(let j=0;j<=steps;j++) {
      const angle=Math.PI*j/steps, c=Math.cos(angle), extension=Math.sin(angle)*.025*(endT===0?-1:1);
      for(let i=0;i<=cols;i++) {
        const u=i/cols, across=Math.abs(2*u-1), round=Math.sqrt(Math.max(0,1-Math.pow(across,8)));
        const normal=(c>=0?.037:.029)*c*round;
        vertices.push((2*u-1)*cushionHalfWidth(endT),point.y-tangent.z*normal+tangent.y*extension*round,point.z+tangent.y*normal+tangent.z*extension*round);
        uvs.push(u,endT);
        if(j<steps && i<cols) {
          const a=start+j*(cols+1)+i,b=a+cols+1;
          if(endT===0) indices.push(a,b,a+1,b,b+1,a+1); else indices.push(a,a+1,b,b,a+1,b+1);
        }
      }
    }
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const faceIndices=rows*cols*6;
  geometry.addGroup(0,faceIndices,0); geometry.addGroup(faceIndices,faceIndices,1);
  geometry.addGroup(faceIndices*2,indices.length-faceIndices*2,2);
  const cushion=createChairPart(geometry,[fabric,backing,edgeFabric]); cushion.name='chair-cushion'; chair.add(cushion);
  // Keep the seat supports at the arms and taper the upper rails behind the upholstery.
  const backInset = y => .060 * THREE.MathUtils.smoothstep(y, .59, 1.03);
  for (const side of [-1,1]) {
    const points=curve.getSpacedPoints(96).map((p,i)=>new THREE.Vector3(side*(cushionHalfWidth(i/96)-.002),p.y,p.z));
    const piping=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),96,.003,8,false),edgeFabric); piping.castShadow=true; chair.add(piping);
    const railShape=new THREE.Shape(), samples=64;
    const railPoint=(i,offset)=>{
      const t=.01+.97*i/samples, p=curve.getPointAt(t), tangent=curve.getTangentAt(t);
      // The rail follows the back of the cushion at a constant normal offset.
      return [-p.z+tangent.y*(.045-offset),p.y+tangent.z*(.045-offset)];
    };
    for (let i=0;i<=samples;i++) { const [x,y]=railPoint(i,.016); if(i===0) railShape.moveTo(x,y); else railShape.lineTo(x,y); }
    for (let i=samples;i>=0;i--) { const [x,y]=railPoint(i,-.016); railShape.lineTo(x,y); }
    railShape.closePath();
    const railGeometry=new THREE.ExtrudeGeometry(railShape,{depth:.037,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2});
    const railPositions=railGeometry.attributes.position;
    for(let i=0;i<railPositions.count;i++) {
      railPositions.setZ(i,railPositions.getZ(i)-side*backInset(railPositions.getY(i)));
    }
    railGeometry.computeVertexNormals();
    const rail=createChairPart(railGeometry,[birch,laminate]);
    rail.name=`chair-support-${side}`;
    // Keep the supporting frame just inside the arm: their side faces meet,
    // instead of the two wooden parts passing through each other.
    rail.rotation.y=Math.PI/2; rail.position.x=side*.329-.0185; chair.add(rail);
    for (const t of [.53,.75]) {
      const p=curve.getPointAt(t), screw=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.004,16),metal);
      const tangent=curve.getTangentAt(t);
      const screwY=p.y+tangent.z*.045;
      screw.rotation.z=Math.PI/2; screw.position.set(side*(.351-backInset(screwY)),screwY,p.z-tangent.y*.045); chair.add(screw);
    }
  }
  // Exposed cross slats on the back and stretchers beneath the seat and base.
  for (const t of [.55,.68,.81,.96]) {
    const p=curve.getPointAt(t), tangent=curve.getTangentAt(t);
    const slatY=p.y+tangent.z*.052, halfWidth=.33-backInset(slatY);
    const slatGeometry=new RoundedBoxGeometry(2*halfWidth,.032,.028,4,.006);
    const position=slatGeometry.attributes.position;
    // A shallow bow gives each laminated crosspiece the natural curve seen at the back.
    for(let i=0;i<position.count;i++) {
      const across=position.getX(i)/halfWidth;
      position.setZ(i,position.getZ(i)-.009*Math.max(0,1-across*across));
    }
    slatGeometry.computeVertexNormals();
    const slat=new THREE.Mesh(slatGeometry,birch);
    slat.rotation.x=Math.atan2(tangent.z,tangent.y);
    slat.position.set(0,slatY,p.z-tangent.y*.052);
    slat.castShadow=slat.receiveShadow=true; chair.add(slat);
  }
  roundedBox(chair,[.71,.045,.035],[0,.35,.36],birch,.006); roundedBox(chair,[.70,.032,.035],[0,.055,-.40],birch,.006);
  return chair;
}
