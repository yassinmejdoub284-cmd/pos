const Jimp = require('jimp');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 384];
const inputFile = path.join(__dirname, 'public', 'favicons', 'android-chrome-512x512.png');
const outputDir = path.join(__dirname, 'public', 'favicons');

async function generateIcons() {
    console.log('Generating PWA icons with Jimp...');

    try {
        const image = await Jimp.read(inputFile);

        for (const size of sizes) {
            const fileName = `android-chrome-${size}x${size}.png`;
            const outputFile = path.join(outputDir, fileName);

            try {
                const resized = image.clone().resize(size, size);
                await resized.writeAsync(outputFile);
                console.log(`✓ Generated ${fileName}`);
            } catch (err) {
                console.error(`✗ Failed to generate ${fileName}:`, err.message);
            }
        }

        console.log('\nAll icons generated successfully!');
    } catch (err) {
        console.error('Error loading source image:', err.message);
        process.exit(1);
    }
}

generateIcons();
