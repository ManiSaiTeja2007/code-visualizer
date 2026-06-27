def generate_memory_svg(step_data, show_addresses=True):
    """
    Generates a beautiful, glowing SVG representing the Stack and Heap memory layout.
    """
    
    stack = step_data.get("stack", [])
    heap = step_data.get("heap", [])
    crash = step_data.get("crash", None)
    
    svg_width = 800
    svg_height = 420
    
    # Modern glowing dark theme colors
    bg_color = "#0F0F1A"
    card_bg = "#1A1A2E"
    card_border = "#333355"
    text_primary = "#E2E8F0"
    text_secondary = "#94A3B8"
    accent_green = "#00FF66"
    accent_blue = "#00F0FF"
    accent_red = "#FF3366"
    accent_purple = "#A855F7"
    
    # Build HTML/SVG content
    svg_parts = [
        f'<svg width="100%" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}" xmlns="http://www.w3.org/2000/svg" style="background:{bg_color}; font-family: \'JetBrains Mono\', \'Courier New\', monospace; border-radius: 12px; border: 1px solid {card_border};">',
        # Definitions for markers (arrows) and hover animations
        '<defs>',
        f'  <marker id="arrow-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        f'    <path d="M 0 2 L 10 5 L 0 8 z" fill="{accent_blue}"/>',
        '  </marker>',
        f'  <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        f'    <path d="M 0 2 L 10 5 L 0 8 z" fill="{accent_red}"/>',
        '  </marker>',
        f'  <linearGradient id="glow-red" x1="0%" y1="0%" x2="100%" y2="100%">',
        f'    <stop offset="0%" stop-color="#FF3366" stop-opacity="0.2"/>',
        f'    <stop offset="100%" stop-color="#0F0F1A" stop-opacity="0.9"/>',
        '  </linearGradient>',
        '  <style>',
        '    .mem-row { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }',
        f'   .mem-row:hover {{ filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.6)); stroke: {accent_blue}; stroke-width: 1.5px; transform: translate(1px, 0); }}',
        f'   .mem-row-nullptr:hover {{ filter: drop-shadow(0 0 8px rgba(255, 51, 102, 0.8)); stroke: {accent_red}; stroke-width: 1.5px; }}',
        '    .heap-block { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }',
        f'   .heap-block:hover {{ filter: drop-shadow(0 0 8px rgba(0, 255, 102, 0.6)); stroke: {accent_green}; stroke-width: 1.8px; }}',
        '  </style>',
        '</defs>',
        
        # Grid Background Pattern
        '<g opacity="0.05">',
        '  <path d="' + ' '.join([f'M {x} 0 L {x} {svg_height}' for x in range(0, svg_width, 40)]) + '" stroke="#FFFFFF" stroke-width="1"/>',
        '  <path d="' + ' '.join([f'M 0 {y} L {svg_width} {y}' for y in range(0, svg_height, 40)]) + '" stroke="#FFFFFF" stroke-width="1"/>',
        '</g>',
        
        # Stack Panel header
        f'<rect x="20" y="20" width="360" height="380" rx="10" fill="{card_bg}" stroke="{card_border}" stroke-width="1.5" />',
        f'<text x="40" y="45" fill="{accent_purple}" font-size="16" font-weight="bold">STACK (Local variables)</text>',
        
        # Heap Panel header
        f'<rect x="420" y="20" width="360" height="380" rx="10" fill="{card_bg}" stroke="{card_border}" stroke-width="1.5" />',
        f'<text x="440" y="45" fill="{accent_blue}" font-size="16" font-weight="bold">HEAP (Dynamic allocations)</text>'
    ]
    
    # Store coordinates of variable cells to draw pointer arrows later
    addr_to_coords = {}
    ptr_coords = []
    
    # 1. Render Stack Frames
    if not stack:
        svg_parts.append(f'<text x="40" y="150" fill="{text_secondary}" font-size="14">Stack Empty</text>')
    else:
        y_offset = 70
        for frame_idx, frame in enumerate(stack):
            frame_name = frame.get("name", "main")
            vars_list = frame.get("variables", [])
            
            frame_height = 30 + (len(vars_list) * 35)
            # Frame boundary
            svg_parts.append(
                f'<rect x="35" y="{y_offset}" width="330" height="{frame_height}" rx="6" fill="#141425" stroke="#4B5563" stroke-width="1" stroke-dasharray="4" />'
            )
            svg_parts.append(
                f'<text x="45" y="{y_offset + 20}" fill="{text_secondary}" font-size="12" font-weight="bold">Scope: {frame_name}()</text>'
            )
            
            var_y = y_offset + 40
            for var in vars_list:
                var_name = var.get("name")
                var_type = var.get("type")
                var_val = var.get("value")
                var_addr = var.get("addr")
                
                # Check highlighting / crash focus
                is_ptr = "*" in var_type
                is_nullptr = is_ptr and (var_val == "NULL" or var_val == "0x0" or var_val == "0x00000000")
                
                cell_bg = "#1B1429" if is_ptr else "#111827"
                cell_border = "#6B21A8" if is_ptr else "#374151"
                if is_nullptr and crash:
                    cell_bg = "#3B1420"
                    cell_border = accent_red
                
                # Variable Row Block with hover effect group
                row_class = "mem-row-nullptr" if (is_nullptr and crash) else "mem-row"
                svg_parts.append(f'<g class="{row_class}">')
                svg_parts.append(
                    f'<rect x="45" y="{var_y - 12}" width="310" height="28" rx="4" fill="{cell_bg}" stroke="{cell_border}" stroke-width="1"/>'
                )
                
                # Address label (glowing gray) - hidden if show_addresses is False
                addr_text = var_addr if show_addresses else ""
                svg_parts.append(
                    f'<text x="52" y="{var_y + 6}" fill="#475569" font-size="11">{addr_text}</text>'
                )
                
                # Name & Type
                svg_parts.append(
                    f'<text x="125" y="{var_y + 6}" fill="{text_primary}" font-size="12">{var_type} {var_name} =</text>'
                )
                
                # Value (highlight pointers in cyan, null in red, integers in green)
                val_color = accent_green
                if is_ptr:
                    val_color = accent_red if is_nullptr else accent_blue
                
                svg_parts.append(
                    f'<text x="260" y="{var_y + 6}" fill="{val_color}" font-size="12" font-weight="bold">{var_val}</text>'
                )
                svg_parts.append('</g>')
                
                # Save coordinates
                addr_to_coords[var_addr] = (50, var_y + 2) # Stack variables addresses are on left
                if is_ptr:
                    # Save pointer starting line coordinate (from center-right of cell)
                    ptr_coords.append({
                        "from_addr": var_addr,
                        "to_addr": var_val,
                        "from_coord": (340, var_y + 2),
                        "is_null": is_nullptr
                    })
                
                var_y += 35
            y_offset += frame_height + 15
            
    # 2. Render Heap
    if not heap:
        svg_parts.append(
            f'<text x="440" y="150" fill="{text_secondary}" font-size="14">Heap Empty (No dynamic memory)</text>'
        )
    else:
        heap_y = 70
        for block in heap:
            block_addr = block.get("addr")
            block_val = block.get("value")
            block_label = block.get("label", "malloc'd")
            block_size = block.get("size", "")
            
            # Heap block representation with hover effect group
            svg_parts.append('<g class="heap-block">')
            svg_parts.append(
                f'<rect x="440" y="{heap_y - 12}" width="320" height="40" rx="4" fill="#0D253F" stroke="{accent_blue}" stroke-width="1.2"/>'
            )
            addr_text = block_addr if show_addresses else ""
            svg_parts.append(
                f'<text x="448" y="{heap_y + 8}" fill="#475569" font-size="11">{addr_text}</text>'
            )
            svg_parts.append(
                f'<text x="515" y="{heap_y + 8}" fill="{text_primary}" font-size="12">{block_label} ({block_size}) =</text>'
            )
            svg_parts.append(
                f'<text x="690" y="{heap_y + 8}" fill="{accent_green}" font-size="12" font-weight="bold">{block_val}</text>'
            )
            svg_parts.append('</g>')
            
            # Save address coordinates for pointers
            addr_to_coords[block_addr] = (435, heap_y + 8) # Heap blocks have target coordinate on left boundary
            
            heap_y += 55

    # 3. Draw Pointer Connection Lines / Arrows
    for p in ptr_coords:
        from_x, from_y = p["from_coord"]
        to_addr = p["to_addr"]
        
        if p["is_null"]:
            if crash:
                # Draw a warning lightning bolt or broken arrow towards "NULL"
                svg_parts.append(
                    f'<line x1="{from_x}" y1="{from_y}" x2="{from_x + 30}" y2="{from_y}" stroke="{accent_red}" stroke-width="2" stroke-dasharray="3,3"/>'
                )
                svg_parts.append(
                    f'<circle cx="{from_x + 30}" cy="{from_y}" r="4" fill="{accent_red}"/>'
                )
            continue
            
        # If target address is in our coordinates map, draw arrow
        target_coord = addr_to_coords.get(to_addr)
        if target_coord:
            to_x, to_y = target_coord
            
            # Calculate bezier control points for a smooth curve
            mid_x = (from_x + to_x) / 2
            dx = to_x - from_x
            
            # Bezier path: start -> control1 -> control2 -> end
            # Using absolute coordinates
            path_d = f"M {from_x} {from_y} C {from_x + dx*0.4} {from_y}, {to_x - dx*0.4} {to_y}, {to_x} {to_y}"
            
            svg_parts.append(
                f'<path d="{path_d}" fill="none" stroke="{accent_blue}" stroke-width="2" marker-end="url(#arrow-blue)" opacity="0.85"/>'
            )
        else:
            # Pointers to unallocated/wild memory or out of bounds
            # Draw line off-screen or marked as invalid
            svg_parts.append(
                f'<line x1="{from_x}" y1="{from_y}" x2="{from_x + 40}" y2="{from_y}" stroke="{accent_red}" stroke-width="2" marker-end="url(#arrow-red)"/>'
            )
            svg_parts.append(
                f'<text x="{from_x + 45}" y="{from_y + 4}" fill="{accent_red}" font-size="10" font-weight="bold">INVALID</text>'
            )

    # 4. Render Segmentation Fault / Core Dump crash indicator
    if crash:
        # Blurred background overlay
        svg_parts.append(
            f'<rect x="15" y="15" width="{svg_width - 30}" height="{svg_height - 30}" rx="12" fill="url(#glow-red)" stroke="{accent_red}" stroke-width="2" style="backdrop-filter: blur(4px);" />'
        )
        
        # Crash Dialog Card
        svg_parts.append(
            f'<rect x="150" y="80" width="500" height="240" rx="8" fill="#1C0E14" stroke="{accent_red}" stroke-width="2"/>'
        )
        svg_parts.append(
            f'<text x="250" y="115" fill="{accent_red}" font-size="18" font-weight="bold" letter-spacing="1">⚠️ PROCESS CRASHED ⚠️</text>'
        )
        svg_parts.append(
            f'<text x="180" y="150" fill="{text_primary}" font-size="13" font-weight="bold">Signal: {crash.get("type", "SIGSEGV")} (Segmentation Fault)</text>'
        )
        svg_parts.append(
            f'<text x="180" y="175" fill="{text_secondary}" font-size="12">Reason: {crash.get("msg", "")}</text>'
        )
        svg_parts.append(
            f'<text x="180" y="195" fill="{text_secondary}" font-size="12">Faulting Target Address: {crash.get("target", "0x00000000")}</text>'
        )
        
        # What is Core Dump explanation inside the box
        svg_parts.append(
            f'<rect x="175" y="215" width="450" height="85" rx="4" fill="#0A0609" stroke="#5E1E28" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<text x="185" y="235" fill="{accent_purple}" font-size="11" font-weight="bold">What does "Core Dumped" mean?</text>'
        )
        svg_parts.append(
            f'<text x="185" y="255" fill="{text_secondary}" font-size="10">The CPU caught an Access Violation. The OS terminated the process</text>'
        )
        svg_parts.append(
            f'<text x="185" y="270" fill="{text_secondary}" font-size="10">and dumped a snapshot of the program\'s RAM configuration to a file</text>'
        )
        svg_parts.append(
            f'<text x="185" y="285" fill="{text_secondary}" font-size="10">(.core) so developers can analyze the stack trace post-mortem.</text>'
        )

    svg_parts.append('</svg>')
    return '\n'.join(svg_parts)
