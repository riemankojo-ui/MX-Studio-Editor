const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = './effects';

console.log("Compressing effects folder...");

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')) {
    const filePath = path.join(dir, file);
    const newPath = path.join(dir, file.replace(/\.(jpg|jpeg|png)$/, '.webp'));

    // Convert to WebP and resize to max 1000px
    sharp(filePath)
      .resize({ width: 1000, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(newPath)
      .then(info => {
        console.log(`✅ ${file} -> webp (${Math.round(info.size / 1024)} KB)`);
        fs.unlinkSync(filePath); // Deletes the old huge jpg
      })
      .catch(err => console.error(`❌ Failed: ${file}`, err));
  }
});