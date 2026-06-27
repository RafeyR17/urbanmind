const fs = require('fs');
const path = require('path');

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

for (const dir of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
  copyDir(path.join(cesiumBuild, dir), path.join(publicCesium, dir));
}

console.log('Copied Cesium static assets to public/cesium');
