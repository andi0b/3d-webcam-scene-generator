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
  chair.scale.set(.78,.85,.85);
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
  // The two yarn directions alternate over and under at each crossing.
  const tile = 256, pitch = 8, yarns = tile / pitch;
  const heights = new Float32Array(tile * tile);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tile;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(tile, tile);
  function yarnNoise(x, y) {
    let h = Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(y + 1, 0x119de1f3);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296 - .5;
  }
  for (let y=0; y<tile; y++) for (let x=0; x<tile; x++) {
    const warp = (x + .65 * Math.sin(2*Math.PI*y/64) + tile) / pitch;
    const weft = (y + .55 * Math.sin(2*Math.PI*x/128) + tile) / pitch;
    const col = Math.floor(warp) % yarns, row = Math.floor(weft) % yarns;
    const warpRidge = Math.sin(Math.PI * (warp % 1));
    const weftRidge = Math.sin(Math.PI * (weft % 1));
    const over = (col + row) % 2 === 0;
    const a = warpRidge * (over ? 1 : .54), b = weftRidge * (over ? .54 : 1);
    const vertical = a > b;
    const height = heights[y*tile+x] = Math.max(a,b);
    const dye = vertical ? yarnNoise(col,91) : yarnNoise(73,row);
    const fleck = vertical ? yarnNoise(col,y>>4) : yarnNoise(x>>4,row);
    const value = 192 + 47*height + 42*dye + 34*fleck + 14*yarnNoise(x,y);
    const i = (y*tile+x)*4;
    pixels.data[i] = value + 2;
    pixels.data[i+1] = value;
    pixels.data[i+2] = value - 3;
    pixels.data[i+3] = 255;
  }
  ctx.putImageData(pixels,0,0);
  const clothMap = new THREE.CanvasTexture(canvas);
  clothMap.colorSpace = THREE.SRGBColorSpace;
  const weave = createNormalTexture(tile,tile,(x,y)=>heights[y*tile+x],.78);
  for (const map of [clothMap,weave]) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(6,13);
    map.anisotropy = 8;
  }
  const fabric = new THREE.MeshPhysicalMaterial({color:'#b6ac9f', map:clothMap,
    roughness:1, sheen:.12, sheenColor:'#cdc0b2', sheenRoughness:1,
    normalMap:weave, vertexColors:true, side:THREE.DoubleSide});
  const edgeFabric = fabric.clone();
  edgeFabric.vertexColors = false;
  const backing = edgeFabric.clone();
  backing.color.set('#c8c6bf');
  const metal = new THREE.MeshStandardMaterial({ color: '#b9bab5', metalness: .35, roughness: .48 });

  function addFastener(side, x, y, z) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .003, 16), metal);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(side*x, y, z);
    chair.add(screw);
    return screw;
  }

  // Shared profile keeps the pads and the bentwood cradle aligned.
  const profile = [[.39,.45],[.26,.44],[.06,.414],[-.13,.390],[-.205,.384],[-.25,.416],[-.267,.51],[-.295,.605],[-.37,.745],[-.448,.88],[-.496,1.015],[-.50,1.16]];
  const curve = new THREE.CatmullRomCurve3(profile.map(([z,y]) => new THREE.Vector3(0,y,z)), false, 'centripetal');
  const curveLength = curve.getLength();
  const jointPoint = curve.getPointAt(.72);
  const jointTangent = curve.getTangentAt(.72);
  const jointDepth = -jointPoint.z + .045 * jointTangent.y;
  const jointHeight = jointPoint.y + .045 * jointTangent.z;

  // Flat, continuously bent side frames form the floor runners and arms.
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(.43,.006); shape.lineTo(-.26,.006);
    shape.bezierCurveTo(-.332,.006,-.345,.035,-.348,.128); shape.lineTo(-.356,.51);
    shape.bezierCurveTo(-.358,.578,-.339,.603,-.284,.615); shape.lineTo(.18,.665);
    shape.bezierCurveTo(.30,.678,jointDepth-.048,jointHeight-.076,jointDepth+.010,jointHeight+.046);
    shape.quadraticCurveTo(jointDepth+.015,jointHeight+.053,jointDepth+.039,jointHeight+.032);
    shape.bezierCurveTo(jointDepth-.014,jointHeight-.069,.32,.653,.18,.635); shape.lineTo(-.276,.585);
    shape.quadraticCurveTo(-.329,.578,-.326,.51); shape.lineTo(-.318,.128);
    shape.quadraticCurveTo(-.315,.036,-.26,.036); shape.lineTo(.43,.036); shape.closePath();
    const frame = createChairPart(new THREE.ExtrudeGeometry(shape, { depth: .078, bevelEnabled: true, bevelSize: .006, bevelThickness: .003, bevelSegments: 3, curveSegments: 20 }), [birch,laminate]);
    frame.name = `chair-arm-${side}`;
    frame.rotation.y = Math.PI / 2; frame.position.x = side * .394 - .039; chair.add(frame);
  }

  const cushionHalfWidth = t => {
    const front=Math.min(1,t/.035), head=Math.min(1,(1-t)/.045);
    return .350-.008*(1-Math.sqrt(Math.max(0,front)))-.020*(1-Math.sqrt(Math.max(0,head)));
  };
  function addPad(startT, endT, name) {
    const headrest = name === 'chair-headrest';
    const seat = name === 'chair-cushion';
    function edgeRound(across) {
      return (1 - across ** (seat ? 14 : 8)) ** (seat ? .23 : .5);
    }
    function upholstery(u, t) {
      const along = (t - startT) / (endT - startT);
      if (headrest) return { loft: .066 + .026 * Math.sin(Math.PI * along), shade: 1 };
      // Three broad upholstered panels, pinched where the stitched channels meet.
      const distance = Math.abs(2*u - 1) - 1/3;
      const column = Math.exp(-Math.pow(distance / .055, 2));
      const phase = (t - .545) / .108 + .065 * Math.sin(3 * Math.PI * u) ** 2;
      const nearest = Math.round(phase);
      const row = nearest >= 0 && nearest <= 2
        ? Math.exp(-Math.pow((phase - nearest) / .12, 2)) : 0;
      const field = Math.sin(3 * Math.PI * u) ** 2;
      const shade = 1 - .20 * column ** 5 - .29 * row ** 5;
      return { loft: (seat ? .062 : .052) + .010 * field - .009 * column - .009 * row - .006 * column * row, shade };
    }
    // Include the distance down the sidewall in the transverse fabric coordinate.
    function fabricU(u, round, loft) {
      return u + Math.sign(u - .5) * (1-round) * loft / .70;
    }
    const geometry = new THREE.BufferGeometry(), vertices = [], uvs = [], colors = [], indices = [], rows = headrest ? 24 : 156, cols = 60;
    const layerSize=(rows+1)*(cols+1);
    for (let layer=0; layer<2; layer++) for (let j=0; j<=rows; j++) {
      const t=THREE.MathUtils.lerp(startT, endT, j/rows), point=curve.getPointAt(t), tangent=curve.getTangentAt(t);
      // Taper the corners at the head and seat front, with a full cushioned center.
      const width=cushionHalfWidth(t);
      for (let i=0; i<=cols; i++) {
        const u=(1-Math.cos(Math.PI*i/cols))/2, across=Math.abs(2*u-1), round=edgeRound(across);
        const {loft, shade} = upholstery(u, t);
        const thickness = (layer === 0 ? loft : -.029) * round;
        colors.push(shade, shade, shade);
        vertices.push((2*u-1)*width,point.y-tangent.z*thickness,point.z+tangent.y*thickness); uvs.push(fabricU(u,round,layer === 0 ? loft : .029),t);
        if (j<rows && i<cols) {
          const a=layer*layerSize+j*(cols+1)+i, b=a+cols+1;
          if (layer===0) indices.push(a,a+1,b,b,a+1,b+1); else indices.push(a,b,a+1,b,b+1,a+1);
        }
      }
    }
    // Roll the ends over rather than closing the cushion with a flat cut face.
    for (const capT of [startT,endT]) {
      const point=curve.getPointAt(capT), tangent=curve.getTangentAt(capT), start=vertices.length/3, steps=12;
      for(let j=0;j<=steps;j++) {
        const angle=Math.PI*j/steps, c=Math.cos(angle), extension=Math.sin(angle)*.025*(capT===startT?-1:1);
        for(let i=0;i<=cols;i++) {
          const u=(1-Math.cos(Math.PI*i/cols))/2, across=Math.abs(2*u-1), round=edgeRound(across);
          const normal=(c>=0 ? upholstery(u, capT).loft : .029)*c*round;
          vertices.push((2*u-1)*cushionHalfWidth(capT),point.y-tangent.z*normal+tangent.y*extension*round,point.z+tangent.y*normal+tangent.z*extension*round);
          const loft = upholstery(u, capT).loft;
          const arc = angle * (.025 + (loft + .029)/2) / 2;
          const direction = capT === startT ? -1 : 1;
          uvs.push(fabricU(u, round, THREE.MathUtils.lerp(.029,loft,(1+c)/2)), capT + direction * arc * round / curveLength);
          colors.push(1,1,1);
          if(j<steps && i<cols) {
            const a=start+j*(cols+1)+i,b=a+cols+1;
            if(capT===startT) indices.push(a,b,a+1,b,b+1,a+1); else indices.push(a,a+1,b,b,a+1,b+1);
          }
        }
      }
    }
    if (seat) {
      // A welt outlines the boxed side panel, following both rounded ends.
      for (const side of [-1, 1]) {
        const points = [];
        const across = .977, u = (1 + across * side) / 2;
        function seamPoint(t, angle, extension) {
          const point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
          const c = Math.cos(angle);
          const height = edgeRound(across) * c * (c >= 0 ? upholstery(u,t).loft : .029);
          points.push(new THREE.Vector3(across * side * cushionHalfWidth(t),
            point.y - tangent.z * height + tangent.y * extension,
            point.z + tangent.y * height + tangent.z * extension));
        }
        for (let j=0;j<=32;j++) seamPoint(THREE.MathUtils.lerp(startT,endT,j/32),0,0);
        for (let j=1;j<12;j++) seamPoint(endT,Math.PI*j/12,.025*edgeRound(across)*Math.sin(Math.PI*j/12));
        for (let j=32;j>=0;j--) seamPoint(THREE.MathUtils.lerp(startT,endT,j/32),Math.PI,0);
        for (let j=1;j<12;j++) seamPoint(startT,Math.PI*(1+j/12),-.025*edgeRound(across)*Math.sin(Math.PI*j/12));
        const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),96,.0018,6,true),edgeFabric);
        chair.add(seam);
      }
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const faceIndices=rows*cols*6;
    geometry.addGroup(0,faceIndices,0); geometry.addGroup(faceIndices,faceIndices,1);
    geometry.addGroup(faceIndices*2,indices.length-faceIndices*2,2);
    const cushion=createChairPart(geometry,[fabric,backing,edgeFabric]); cushion.name=name; chair.add(cushion);
  }
  addPad(0, .425, 'chair-cushion');
  addPad(.441, .832, 'chair-back-pad');
  addPad(.854, 1, 'chair-headrest');
  // Parallel side faces provide a flush mounting surface for each arm.
  for (const side of [-1,1]) {
    const railShape=new THREE.Shape(), samples=64;
    const railPoint=(i,offset)=>{
      const t=.027+.970*i/samples, p=curve.getPointAt(t), tangent=curve.getTangentAt(t);
      // The rail follows the back of the cushion at a constant normal offset.
      const back = THREE.MathUtils.smoothstep(t, .40, .56);
      const railOffset = THREE.MathUtils.lerp(.034, .045, back) - offset * (.52 + .48 * back);
      return [-p.z+tangent.y*railOffset,p.y+tangent.z*railOffset];
    };
    for (let i=0;i<=samples;i++) { const [x,y]=railPoint(i,.016); if(i===0) railShape.moveTo(x,y); else railShape.lineTo(x,y); }
    for (let i=samples;i>=0;i--) { const [x,y]=railPoint(i,-.016); railShape.lineTo(x,y); }
    railShape.closePath();
    const railGeometry=new THREE.ExtrudeGeometry(railShape,{depth:.037,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2});
    const rail=createChairPart(railGeometry,[birch,laminate]);
    rail.name=`chair-support-${side}`;
    // Keep the supporting frame just inside the arm: their side faces meet,
    // instead of the two wooden parts passing through each other.
    rail.rotation.y=Math.PI/2; rail.position.x=side*.33049-.0185; chair.add(rail);
    addFastener(side, .4365, jointHeight, -jointDepth).name = `chair-arm-bolt-${side}`;
    addFastener(side, .4365, .34, .339);
    addFastener(side, .4365, .022, -.419);
    const lumbar=curve.getPointAt(.53), tangent=curve.getTangentAt(.53);
    const screwY=lumbar.y+tangent.z*.045;
    addFastener(side, .352, screwY, lumbar.z-tangent.y*.045);
  }
  // Exposed cross slats on the back and stretchers beneath the seat and base.
  for (const t of [.52,.67,.835,.97]) {
    const p=curve.getPointAt(t), tangent=curve.getTangentAt(t);
    const slatY=p.y+tangent.z*.052, halfWidth=.33;
    const slatGeometry=new RoundedBoxGeometry(2*halfWidth,.048,.022,4,.006);
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
  roundedBox(chair,[.76,.056,.035],[0,.34,.339],birch,.006); roundedBox(chair,[.76,.027,.035],[0,.022,-.420],birch,.006);
  return chair;
}
