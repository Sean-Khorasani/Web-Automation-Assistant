#!/usr/bin/env python3
"""
Generate PNG icons with the actual design (record/play button with corner dots)
Since we can't use external libraries, we'll create the PNGs using raw bytes
"""
import struct
import zlib
import os

def create_png(width, height, pixels):
    """Create a PNG file from raw pixel data"""
    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter type: none
        for x in range(width):
            idx = (y * width + x) * 4
            raw_data += pixels[idx:idx+4]
    
    compressed = zlib.compress(raw_data, 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return signature + ihdr_chunk + idat_chunk + iend_chunk

def draw_circle(pixels, width, height, cx, cy, radius, color):
    """Draw a filled circle"""
    for y in range(max(0, cy - radius), min(height, cy + radius + 1)):
        for x in range(max(0, cx - radius), min(width, cx + radius + 1)):
            dx = x - cx
            dy = y - cy
            if dx*dx + dy*dy <= radius*radius:
                idx = (y * width + x) * 4
                pixels[idx:idx+4] = color

def draw_triangle(pixels, width, height, points, color):
    """Draw a filled triangle using scanline algorithm"""
    # Sort points by y coordinate
    points = sorted(points, key=lambda p: p[1])
    
    if points[2][1] == points[0][1]:
        return  # Degenerate triangle
    
    # Scan from top to bottom
    for y in range(points[0][1], points[2][1] + 1):
        if y < 0 or y >= height:
            continue
            
        # Find x intersections
        x_intersections = []
        
        # Check each edge
        edges = [(points[0], points[1]), (points[1], points[2]), (points[2], points[0])]
        for p1, p2 in edges:
            if p1[1] == p2[1]:  # Horizontal edge
                continue
            if y < min(p1[1], p2[1]) or y > max(p1[1], p2[1]):
                continue
            # Linear interpolation
            t = (y - p1[1]) / (p2[1] - p1[1])
            x = int(p1[0] + t * (p2[0] - p1[0]))
            x_intersections.append(x)
        
        if len(x_intersections) >= 2:
            x_intersections.sort()
            for x in range(max(0, x_intersections[0]), min(width, x_intersections[-1] + 1)):
                idx = (y * width + x) * 4
                # Blend with existing pixel (semi-transparent)
                existing = pixels[idx:idx+4]
                alpha = color[3] / 255.0
                pixels[idx] = int(existing[0] * (1 - alpha) + color[0] * alpha)
                pixels[idx+1] = int(existing[1] * (1 - alpha) + color[1] * alpha)
                pixels[idx+2] = int(existing[2] * (1 - alpha) + color[2] * alpha)
                pixels[idx+3] = max(existing[3], color[3])

def create_icon(size):
    """Create an icon of the specified size"""
    width = height = size
    pixels = bytearray(width * height * 4)
    
    # Fill with transparent background
    for i in range(0, len(pixels), 4):
        pixels[i:i+4] = b'\x00\x00\x00\x00'
    
    center = size // 2
    
    # Draw background circle (blue)
    draw_circle(pixels, width, height, center, center, int(size * 0.47), b'\x1e\x40\xaf\xff')
    
    # Draw border circle (lighter blue)
    draw_circle(pixels, width, height, center, center, int(size * 0.45), b'\x3b\x82\xf6\xff')
    draw_circle(pixels, width, height, center, center, int(size * 0.42), b'\x1e\x40\xaf\xff')
    
    # Draw record button (red circle)
    draw_circle(pixels, width, height, center, center, int(size * 0.15), b'\xef\x44\x44\xff')
    
    # Draw play arrow (white, semi-transparent)
    if size >= 32:  # Only draw arrow on larger icons
        arrow_size = int(size * 0.2)
        left = center - arrow_size
        right = center + arrow_size
        top = center - int(arrow_size * 0.7)
        bottom = center + int(arrow_size * 0.7)
        
        points = [
            (left, top),
            (left, bottom),
            (right, center)
        ]
        draw_triangle(pixels, width, height, points, b'\xff\xff\xff\xb0')  # Semi-transparent white
    
    # Draw corner dots (green) - only on larger sizes
    if size >= 48:
        dot_radius = max(2, size // 25)
        margin = int(size * 0.23)
        draw_circle(pixels, width, height, margin, margin, dot_radius, b'\x10\xb9\x81\xff')
        draw_circle(pixels, width, height, size - margin, margin, dot_radius, b'\x10\xb9\x81\xff')
        draw_circle(pixels, width, height, margin, size - margin, dot_radius, b'\x10\xb9\x81\xff')
        draw_circle(pixels, width, height, size - margin, size - margin, dot_radius, b'\x10\xb9\x81\xff')
    
    return create_png(width, height, bytes(pixels))

def create_recording_icon(size):
    """Create a recording icon (similar but with pulsing red theme)"""
    width = height = size
    pixels = bytearray(width * height * 4)
    
    # Fill with transparent background
    for i in range(0, len(pixels), 4):
        pixels[i:i+4] = b'\x00\x00\x00\x00'
    
    center = size // 2
    
    # Draw background circle (dark red)
    draw_circle(pixels, width, height, center, center, int(size * 0.47), b'\x7f\x1d\x1d\xff')
    
    # Draw border circle (bright red)
    draw_circle(pixels, width, height, center, center, int(size * 0.45), b'\xef\x44\x44\xff')
    draw_circle(pixels, width, height, center, center, int(size * 0.42), b'\x7f\x1d\x1d\xff')
    
    # Draw record button (bright red, larger)
    draw_circle(pixels, width, height, center, center, int(size * 0.2), b'\xff\x00\x00\xff')
    
    # Draw recording indicator (white dot in center)
    if size >= 32:
        draw_circle(pixels, width, height, center, center, int(size * 0.08), b'\xff\xff\xff\xff')
    
    # Draw corner dots (red) - only on larger sizes
    if size >= 48:
        dot_radius = max(2, size // 25)
        margin = int(size * 0.23)
        draw_circle(pixels, width, height, margin, margin, dot_radius, b'\xef\x44\x44\xff')
        draw_circle(pixels, width, height, size - margin, margin, dot_radius, b'\xef\x44\x44\xff')
        draw_circle(pixels, width, height, margin, size - margin, dot_radius, b'\xef\x44\x44\xff')
        draw_circle(pixels, width, height, size - margin, size - margin, dot_radius, b'\xef\x44\x44\xff')
    
    return create_png(width, height, bytes(pixels))

# Generate all icon sizes
sizes = [16, 32, 48, 128]

print("Generating normal icons...")
for size in sizes:
    filename = f"icon-{size}.png"
    with open(filename, 'wb') as f:
        f.write(create_icon(size))
    print(f"Created: {filename}")

print("\nGenerating recording icons...")
for size in sizes:
    filename = f"icon-recording-{size}.png"
    with open(filename, 'wb') as f:
        f.write(create_recording_icon(size))
    print(f"Created: {filename}")

print("\nAll icons generated successfully!")
print("These icons feature:")
print("- Blue background with record button and play arrow")
print("- Green corner indicators (on larger sizes)")
print("- Recording icons with red theme and white center dot")