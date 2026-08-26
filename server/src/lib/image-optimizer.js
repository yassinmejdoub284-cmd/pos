// sharp's native binary cannot load from inside a pkg snapshot, and requiring
// it at module load took the whole server down. Load it lazily, and in a pkg
// build load it from the copy on disk beside the executable (build-offline.ps1
// puts sharp and @img under resources/node_modules).
let _sharp = null;
function sharp(input) {
  if (!_sharp) {
    if (process.pkg) {
      const p_ = require('path');
      _sharp = require(p_.join(p_.dirname(process.execPath), 'node_modules', 'sharp'));
    } else {
      _sharp = require('sharp');
    }
  }
  return _sharp(input);
}
const path = require('path');
const fs = require('fs');

class ImageOptimizer {
  /**
   * Optimize and resize an image for web display
   * @param {string} inputPath - Path to the input image
   * @param {string} outputPath - Path to save the optimized image
   * @param {Object} options - Optimization options
   * @returns {Promise<string>} - Path to the optimized image
   */
  static async optimizeImage(inputPath, outputPath, options = {}) {
    const {
      width = 300,
      height = 300,
      quality = 80,
      format = 'webp',
      fit = 'cover'
    } = options;

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Create optimized image
      await sharp(inputPath)
        .resize(width, height, { 
          fit,
          position: 'center'
        })
        .toFormat(format, { 
          quality,
          progressive: true
        })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Error optimizing image:', error);
      throw error;
    }
  }

  /**
   * Create multiple optimized versions of an image
   * @param {string} inputPath - Path to the input image
   * @param {string} baseOutputPath - Base path for output files
   * @returns {Promise<Object>} - Object with paths to different sizes
   */
  static async createOptimizedVersions(inputPath, baseOutputPath) {
    const baseName = path.parse(baseOutputPath).name;
    const ext = path.parse(baseOutputPath).ext;
    const dir = path.dirname(baseOutputPath);

    const versions = {};

    try {
      // Thumbnail (64x64) - for product grid
      const thumbnailPath = path.join(dir, `${baseName}_thumb${ext}`);
      await this.optimizeImage(inputPath, thumbnailPath, {
        width: 64,
        height: 64,
        quality: 70,
        format: 'webp'
      });
      versions.thumbnail = thumbnailPath;

      // Small (150x150) - for product cards
      const smallPath = path.join(dir, `${baseName}_small${ext}`);
      await this.optimizeImage(inputPath, smallPath, {
        width: 150,
        height: 150,
        quality: 75,
        format: 'webp'
      });
      versions.small = smallPath;

      // Medium (300x300) - for product details
      const mediumPath = path.join(dir, `${baseName}_medium${ext}`);
      await this.optimizeImage(inputPath, mediumPath, {
        width: 300,
        height: 300,
        quality: 80,
        format: 'webp'
      });
      versions.medium = mediumPath;

      // Original optimized (max 800x800) - for high-res displays
      const originalPath = path.join(dir, `${baseName}_original${ext}`);
      await this.optimizeImage(inputPath, originalPath, {
        width: 800,
        height: 800,
        quality: 85,
        format: 'webp',
        fit: 'inside'
      });
      versions.original = originalPath;

      return versions;
    } catch (error) {
      console.error('Error creating optimized versions:', error);
      throw error;
    }
  }

  /**
   * Get the appropriate image URL based on context
   * @param {string} baseUrl - Base URL of the image
   * @param {string} context - Context: 'thumbnail', 'small', 'medium', 'original'
   * @returns {string} - Optimized image URL
   */
  static getOptimizedImageUrl(baseUrl, context = 'medium') {
    if (!baseUrl) return null;
    
    const parsed = path.parse(baseUrl);
    const baseName = parsed.name.replace(/_thumb|_small|_medium|_original$/, '');
    const ext = parsed.ext;
    const dir = parsed.dir;

    const contextSuffix = context === 'thumbnail' ? '_thumb' : 
                         context === 'small' ? '_small' :
                         context === 'medium' ? '_medium' :
                         context === 'original' ? '_original' : '_medium';

    return path.join(dir, `${baseName}${contextSuffix}${ext}`).replace(/\\/g, '/');
  }

  /**
   * Clean up old image files when updating
   * @param {string} basePath - Base path of the image
   */
  static async cleanupOldImages(basePath) {
    if (!basePath) return;

    const parsed = path.parse(basePath);
    const baseName = parsed.name.replace(/_thumb|_small|_medium|_original$/, '');
    const ext = parsed.ext;
    const dir = parsed.dir;

    const versions = ['_thumb', '_small', '_medium', '_original'];
    
    for (const version of versions) {
      const filePath = path.join(dir, `${baseName}${version}${ext}`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting old image ${filePath}:`, error);
        }
      }
    }
  }
}

module.exports = ImageOptimizer;
