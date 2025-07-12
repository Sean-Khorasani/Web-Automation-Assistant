#!/usr/bin/env python3
"""
Generate icon files for the Web Automation Recorder extension
"""

from PIL import Image, ImageDraw
import os

def create_icon(size):
    """Create an icon of the specified size"""
    # Create new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background - rounded rectangle
    padding = size // 16
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=size // 8,
        fill=(74, 144, 226, 255)  # #4A90E2
    )
    
    # Record button (red circle) - top left
    record_center = (size * 0.3, size * 0.3)
    record_radius = size * 0.12
    draw.ellipse(
        [
            (record_center[0] - record_radius, record_center[1] - record_radius),
            (record_center[0] + record_radius, record_center[1] + record_radius)
        ],
        fill=(255, 68, 68, 255)  # Red for record
    )
    
    # Play button (triangle) - bottom right
    play_points = [
        (size * 0.55, size * 0.65),
        (size * 0.75, size * 0.75),
        (size * 0.55, size * 0.85)
    ]
    draw.polygon(play_points, fill=(255, 255, 255, 255))
    
    # Automation gear - top right
    gear_center = (size * 0.7, size * 0.3)
    gear_outer = size * 0.12
    gear_inner = size * 0.08
    teeth = 8
    
    # Draw gear teeth
    import math
    gear_points = []
    for i in range(teeth):
        angle1 = (i / teeth) * math.pi * 2
        angle2 = ((i + 0.5) / teeth) * math.pi * 2
        angle3 = ((i + 1) / teeth) * math.pi * 2
        
        # Outer point
        x1 = gear_center[0] + math.cos(angle1) * gear_outer
        y1 = gear_center[1] + math.sin(angle1) * gear_outer
        gear_points.append((x1, y1))
        
        # Inner point
        x2 = gear_center[0] + math.cos(angle2) * gear_inner
        y2 = gear_center[1] + math.sin(angle2) * gear_inner
        gear_points.append((x2, y2))
    
    draw.polygon(gear_points, fill=(255, 255, 255, 255))
    
    # Center hole in gear
    hole_radius = size * 0.04
    draw.ellipse(
        [
            (gear_center[0] - hole_radius, gear_center[1] - hole_radius),
            (gear_center[0] + hole_radius, gear_center[1] + hole_radius)
        ],
        fill=(74, 144, 226, 255)  # Same as background
    )
    
    # Add connecting line between elements
    draw.line(
        [(size * 0.4, size * 0.4), (size * 0.6, size * 0.6)],
        fill=(255, 255, 255, 128),
        width=max(1, size // 32)
    )
    
    return img

def create_recording_icon(size):
    """Create a recording state icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background - red rounded rectangle
    padding = size // 16
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=size // 8,
        fill=(244, 67, 54, 255)  # #F44336
    )
    
    # Large record circle in center
    center = size // 2
    radius = size * 0.3
    draw.ellipse(
        [
            (center - radius, center - radius),
            (center + radius, center + radius)
        ],
        fill=(255, 255, 255, 255)
    )
    
    # Inner red dot
    inner_radius = size * 0.15
    draw.ellipse(
        [
            (center - inner_radius, center - inner_radius),
            (center + inner_radius, center + inner_radius)
        ],
        fill=(244, 67, 54, 255)
    )
    
    return img

# Create icons directory if it doesn't exist
icons_dir = 'icons'
if not os.path.exists(icons_dir):
    os.makedirs(icons_dir)

# Generate standard icons
sizes = [16, 32, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'{icons_dir}/icon-{size}.png', 'PNG')
    print(f'Created icon-{size}.png')

# Generate recording state icons
for size in sizes:
    icon = create_recording_icon(size)
    icon.save(f'{icons_dir}/icon-recording-{size}.png', 'PNG')
    print(f'Created icon-recording-{size}.png')

print('All icons generated successfully!')