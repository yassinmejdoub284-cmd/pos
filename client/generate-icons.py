import os
import sys
import subprocess

# Ensure Pillow is installed
try:
    from PIL import Image
except ImportError:
    print("Installing Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

sizes = [72, 96, 128, 144, 152, 384]
base_dir = os.path.dirname(os.path.abspath(__file__))
source_path = os.path.join(base_dir, 'public', 'favicons', 'android-chrome-512x512.png')
output_dir = os.path.join(base_dir, 'public', 'favicons')

if not os.path.exists(source_path):
    print(f"Error: Source image not found at {source_path}")
    sys.exit(1)

print(f"Opening source image: {source_path}")
try:
    img = Image.open(source_path)
    
    # Handle resampling method compatibility
    if hasattr(Image, 'Resampling'):
        resample_method = Image.Resampling.LANCZOS
    else:
        resample_method = Image.LANCZOS

    for size in sizes:
        output_path = os.path.join(output_dir, f"android-chrome-{size}x{size}.png")
        resized = img.resize((size, size), resample_method)
        resized.save(output_path)
        print(f"Generated {size}x{size}")

    print("All icons generated successfully!")
except Exception as e:
    print(f"Error generating icons: {str(e)}")
    sys.exit(1)
