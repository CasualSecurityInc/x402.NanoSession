# /// script
# dependencies = ["httpx"]
# ///

import base64
import zlib
import sys
import glob
import os
import httpx

def kroki_encode(text):
    """Encodes the diagram text for Kroki API (Deflate + Base64Url)."""
    # 1. Encode to utf-8
    data = text.encode("utf-8")
    # 2. Compress using zlib (max compression)
    compressed = zlib.compress(data, level=9)
    # 3. Base64 encode
    b64 = base64.urlsafe_b64encode(compressed).decode("utf-8")
    return b64

def render_diagram(file_path):
    output_path = file_path.replace("docs/diagrams/", "docs/img/").replace(".mmd", ".svg")
    
    print(f"Rendering {file_path} -> {output_path}...")
    
    with open(file_path, "r") as f:
        diagram_source = f.read()

    # Encode payload
    payload = kroki_encode(diagram_source)
    url = f"https://kroki.io/mermaid/svg/{payload}"

    try:
        # Fetch SVG
        resp = httpx.get(url, timeout=10.0)
        resp.raise_for_status()
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write to file
        with open(output_path, "w") as f:
            f.write(resp.text)
            
    except httpx.HTTPError as e:
        print(f"Error rendering {file_path}: {e}")
        sys.exit(1)

def main():
    # Find all .mmd files in docs/diagrams
    diagrams = glob.glob("docs/diagrams/*.mmd")
    
    if not diagrams:
        print("No .mmd files found in docs/diagrams/")
        return

    print(f"Found {len(diagrams)} diagrams to render via Kroki.io")
    
    for diagram in diagrams:
        render_diagram(diagram)

    print("Done ✨")

if __name__ == "__main__":
    main()
