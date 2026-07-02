const fs = require('fs');
const path = require('path');

// cesium ships ~50mb of workers/assets — next can't bundle them inline
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const cesiumBuild = path.join(__dirname, '../node_modules/cesium/Build/Cesium');
const publicCesium = path.join(__dirname, '../public/cesium');
const public_cesium_root = publicCesium; // same path, kept both names from refactor

for (const dir of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
  const srcDir = path.join(cesiumBuild, dir);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[copy-cesium] skipping missing dir: ${dir}`);
    continue;
  }
  copyDir(srcDir, path.join(public_cesium_root, dir));
}

console.log('cesium assets copied ok');
