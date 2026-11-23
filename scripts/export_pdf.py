#!/usr/bin/env python3
"""
Dossier Headless PDF Exporter.
Generates an A4 McKinsey/Venture-grade PDF from the live dossier instance
via Playwright when available, falling back to headless Chrome/Chromium.

Usage:
    python3 scripts/export_pdf.py <dossier_id> [port] [output_path]
"""
import asyncio
import os
import shutil
import subprocess
import sys
import tempfile


def _find_chrome_binary() -> str | None:
    """Locate a headless-capable Chromium/Chrome binary on the system."""
    candidates = [
        "/usr/bin/google-chrome",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("brave-browser"),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


async def _generate_via_playwright(dossier_id: str, port: int) -> bytes:
    from playwright.async_api import async_playwright

    chrome_bin = _find_chrome_binary()
    async with async_playwright() as p:
        launch_kwargs = {"headless": True}
        if chrome_bin:
            launch_kwargs["executable_path"] = chrome_bin

        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            device_scale_factor=2,
        )
        page = await context.new_page()

        target_url = f"http://127.0.0.1:{port}#print={dossier_id}"
        await page.goto(target_url, wait_until="networkidle", timeout=15000)

        # Wait for dossier to load into DOM, ensure light paper theme, and expand all details accordions
        await page.evaluate("""() => {
            document.documentElement.classList.remove('dark');
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
            ''',
        )

        await context.close()
        await browser.close()
        return pdf_bytes


def _generate_via_chrome_cli(dossier_id: str, port: int) -> bytes:
    """Fallback PDF generation using headless Chrome/Chromium --print-to-pdf."""
    chrome_bin = _find_chrome_binary()
    if not chrome_bin:
        raise RuntimeError("Neither Python 'playwright' nor a Chrome/Chromium binary is available")

    target_url = f"http://127.0.0.1:{port}#print={dossier_id}"
    fd, tmp_pdf = tempfile.mkstemp(suffix=".pdf", prefix="dossier_")
    os.close(fd)
    try:
        proc = subprocess.run(
            [
                chrome_bin,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--no-pdf-header-footer",
                "--virtual-time-budget=4500",
                f"--print-to-pdf={tmp_pdf}",
                target_url,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=25,
            check=False,
        )
        if not os.path.exists(tmp_pdf) or os.path.getsize(tmp_pdf) == 0:
            err = proc.stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"Chrome headless print-to-pdf failed (code {proc.returncode}): {err}")
        with open(tmp_pdf, "rb") as f:
            pdf_bytes = f.read()
        if not pdf_bytes.startswith(b"%PDF"):
            raise RuntimeError("Chrome headless output is not a valid PDF")
        return pdf_bytes
    finally:
        if os.path.exists(tmp_pdf):
            os.remove(tmp_pdf)


async def generate_dossier_pdf(dossier_id: str, port: int = 3000, output_path: str = None) -> bytes:
    try:
        import playwright  # noqa: F401
        pdf_bytes = await _generate_via_playwright(dossier_id, port)
    except ImportError:
        pdf_bytes = _generate_via_chrome_cli(dossier_id, port)

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
