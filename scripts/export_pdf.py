#!/usr/bin/env python3
"""
Dossier Headless PDF Exporter via Playwright.
Generates an A4 McKinsey/Venture-grade PDF from the live dossier instance.

Usage:
    python3 scripts/export_pdf.py <dossier_id> [port] [output_path]
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def generate_dossier_pdf(dossier_id: str, port: int = 3000, output_path: str = None) -> bytes:
    chrome_bin = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
    
    async with async_playwright() as p:
        launch_kwargs = {"headless": True}
        if chrome_bin:
            launch_kwargs["executable_path"] = chrome_bin
            
        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            device_scale_factor=2
        )
        page = await context.new_page()
        
        target_url = f"http://127.0.0.1:{port}#print={dossier_id}"
        await page.goto(target_url, wait_until="networkidle", timeout=15000)
        
        # Wait for dossier to load into DOM and expand all details accordions
        await page.evaluate("""() => {
            const details = document.querySelectorAll('#resultsSection details');
            details.forEach(d => d.setAttribute('open', ''));
        }""")
        
        # Ensure DOM layout is settled
        await page.wait_for_timeout(1000)
        
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "14mm", "bottom": "14mm", "left": "12mm", "right": "12mm"},
            display_header_footer=True,
            header_template='''
                <div style="font-family: monospace; font-size: 7.5pt; color: #a1a1aa; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm;">
                    <span>DOSSIER // ADVERSARIAL VENTURE AUDIT</span>
                    <span></span>
                </div>
            ''',
            footer_template='''
                <div style="font-family: monospace; font-size: 7.5pt; color: #a1a1aa; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm;">
                    <span>EPISTEMIC VERIFICATION PROTOCOL</span>
                    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                </div>
            '''
        )
        
        await context.close()
        await browser.close()
        
        if output_path:
            with open(output_path, "wb") as f:
                f.write(pdf_bytes)
                
        return pdf_bytes

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Error: Missing dossier_id argument\n")
        sys.exit(1)
        
    dossier_id = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    out_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        pdf = asyncio.run(generate_dossier_pdf(dossier_id, port, out_file))
        if not out_file:
            sys.stdout.buffer.write(pdf)
    except Exception as e:
        sys.stderr.write(f"PDF generation error: {e}\n")
        sys.exit(1)
