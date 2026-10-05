import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function optimizeServiceIcons() {
    const servicesDir = path.resolve('public/services');
    const files = fs.readdirSync(servicesDir);

    console.log('--- OPTIMIZING SERVICE ICONS ---');
    let totalBefore = 0;
    let totalAfter = 0;

    for (const file of files) {
        if (file.endsWith('.webm')) continue;
        const filePath = path.join(servicesDir, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        totalBefore += stat.size;
        const ext = path.extname(file).toLowerCase();
        const baseName = path.basename(file, ext);

        // 1. Generate clean WebP version at 256x256 (crisp for icon display)
        const webpPath = path.join(servicesDir, `${baseName}.webp`);
        const webpBuffer = await sharp(filePath)
            .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82, effort: 6 })
            .toBuffer();

        fs.writeFileSync(webpPath, webpBuffer);

        // 2. Also optimize original file in place to avoid broken links
        if (ext === '.jpg' || ext === '.jpeg') {
            const jpgBuffer = await sharp(filePath)
                .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 82, mozjpeg: true })
                .toBuffer();
            fs.writeFileSync(filePath, jpgBuffer);
            totalAfter += jpgBuffer.size || jpgBuffer.length;
        } else if (ext === '.png') {
            const pngBuffer = await sharp(filePath)
                .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
                .png({ compressionLevel: 9, effort: 8 })
                .toBuffer();
            fs.writeFileSync(filePath, pngBuffer);
            totalAfter += pngBuffer.size || pngBuffer.length;
        } else if (ext === '.webp') {
            fs.writeFileSync(filePath, webpBuffer);
            totalAfter += webpBuffer.length;
        }

        const newSize = fs.statSync(filePath).size;
        console.log(`${file}: ${stat.size} B -> ${newSize} B (in-place) | WebP: ${webpBuffer.length} B`);
    }

    // Optimize gobi-65.jpg
    const gobiPath = path.resolve('public/menu/gobi-65.jpg');
    if (fs.existsSync(gobiPath)) {
        const gobiStat = fs.statSync(gobiPath);
        totalBefore += gobiStat.size;
        const gobiWebp = await sharp(gobiPath)
            .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80, effort: 6 })
            .toBuffer();
        fs.writeFileSync(path.resolve('public/menu/gobi-65.webp'), gobiWebp);

        const gobiJpg = await sharp(gobiPath)
            .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
        fs.writeFileSync(gobiPath, gobiJpg);
        totalAfter += gobiJpg.length;
        console.log(`gobi-65.jpg: ${gobiStat.size} B -> ${gobiJpg.length} B | WebP: ${gobiWebp.length} B`);
    }

    console.log('\n--- ASSET OPTIMIZATION RESULTS ---');
    console.log(`Total Before: ${(totalBefore / 1024).toFixed(1)} KB`);
    console.log(`Total After (in-place): ${(totalAfter / 1024).toFixed(1)} KB`);
    console.log(`Reduction: ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`);
}

optimizeServiceIcons().catch(console.error);
