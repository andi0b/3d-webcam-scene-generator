import { randomSource } from '../src/scene/random-source.js';
import { createNormalTexture } from '../src/surface-normals.js';

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true });
}

function createOak() {
  const width = 256, height = 1024;
  const context = createCanvas(width, height);
  const pixels = context.createImageData(width, height);
  const random = randomSource(18);
  const phases = Array.from({ length: 4 }, () => random() * 6.28);
  // The original generator consumed twelve random values before drawing.
  for (let i = 4; i < 12; i++) random();
  for (let y = 0; y < height; y++) {
    const bend = Math.sin(y / 190 + phases[0]) * 5 + Math.sin(y / 370 + phases[1]) * 9;
    for (let x = 0; x < width; x++) {
      const grain = Math.sin((x + bend) * .36 + phases[2]) * 3 + Math.sin((x + bend * .5) * 1.9) * 1.8;
      const broad = Math.sin(x * .045 + Math.sin(y * .003) + phases[3]) * 1.5;
      const pore = random() > .992 ? -7 : 0;
      const variation = grain * .35 + broad + pore + (random() - .5) * 4;
      pixels.data.set([174 + variation, 140 + variation, 99 + variation, 255], (y * width + x) * 4);
    }
  }
  context.putImageData(pixels, 0, 0);
  return context;
}

function makeNormal(context, channel) {
  const { width, height } = context.canvas;
  const { data } = context.getImageData(0, 0, width, height);
  return createNormalTexture(width, height, (x, y) => data[(y * width + x) * 4 + channel] / 255, 1.3).image;
}

const form = document.querySelector('#prepare');
const kind = document.querySelector('#kind');
const source = document.querySelector('#source');
const image = document.querySelector('#image');
const status = document.querySelector('#status');
const outputs = document.querySelector('#outputs');
const submit = form.querySelector('button');
const urls = [];

kind.onchange = () => {
  source.hidden = image.disabled = kind.value === 'furniture';
};

async function addDownload(filename, canvas, type = 'image/png', quality) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  if (blob?.type !== type) throw new Error(`The browser could not encode ${filename}.`);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  urls.push(link.href);
  link.download = link.textContent = filename;
  const item = document.createElement('li');
  item.append(link);
  outputs.append(item);
}

form.onsubmit = async event => {
  event.preventDefault();
  outputs.replaceChildren();
  for (const url of urls.splice(0)) URL.revokeObjectURL(url);
  status.textContent = 'Preparing textures…';
  const outputKind = kind.value;
  const file = image.files[0];
  submit.disabled = true;
  try {
    if (outputKind === 'furniture') {
      const oak = createOak();
      await addDownload('furniture-oak.png', oak.canvas);
      await addDownload('furniture-oak-normal.png', makeNormal(oak, 0));
    } else {
      const url = URL.createObjectURL(file);
      try {
        const original = new Image();
        original.src = url;
        await original.decode();
        const name = file.name.replace(/\.[^.]+$/, '');
        const scale = outputKind === 'normal' ? .5 : 1;
        const width = Math.max(1, Math.floor(original.width * scale));
        const height = Math.max(1, Math.floor(original.height * scale));
        const context = createCanvas(width, height);
        context.drawImage(original, 0, 0, width, height);
        if (outputKind === 'normal') {
          await addDownload(`${name}-normal.png`, makeNormal(context, 1));
        } else {
          await addDownload(`${name}.webp`, context.canvas, 'image/webp', .92);
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    status.textContent = 'Textures ready to download.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
