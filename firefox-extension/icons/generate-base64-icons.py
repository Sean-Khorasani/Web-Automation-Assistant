#!/usr/bin/env python3
"""
Generate proper PNG icons using base64 encoded minimal valid PNGs
"""
import base64
import os

# Minimal valid PNG files (1x1 pixel, different colors)
# These are guaranteed to be valid PNG files

# Blue pixel for normal icon
BLUE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

# Red pixel for recording icon  
RED_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

def create_icon(filename, base64_data):
    """Create an icon file from base64 data"""
    with open(filename, 'wb') as f:
        f.write(base64.b64decode(base64_data))
    print(f"Created: {filename}")

# Create all icon sizes with blue color
for size in [16, 32, 48, 128]:
    create_icon(f"icon-{size}.png", BLUE_PNG_BASE64)

# Create recording icons with red color
for size in [16, 32, 48, 128]:
    create_icon(f"icon-recording-{size}.png", RED_PNG_BASE64)

print("\nAll icons created successfully!")
print("Note: These are minimal 1x1 pixel PNGs that Firefox will accept.")
print("They will appear as solid colored squares in the browser.")