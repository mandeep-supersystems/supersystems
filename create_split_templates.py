import os
import re

def split_module(module_name, html_path, sections):
    if not os.path.exists(html_path):
        print(f"File {html_path} does not exist!")
        return

    with open(html_path, 'r', encoding='utf-8') as f:
        full_html = f.read()

    # Extract header/layout outer structure
    # We find where <main class="..."> starts and ends
    main_match = re.search(r'(<main class="[^"]*">)(.*?)(</main>)', full_html, re.DOTALL)
    if not main_match:
        print(f"Could not find <main> in {html_path}")
        return

    header_nav = full_html[:main_match.start(2)]
    footer_scripts = full_html[main_match.end(2):]

    # Find all <section id="sec-SECTION_NAME" class="content-section"> ... </section>
    sec_matches = list(re.finditer(r'<section id="sec-([^"]+)" class="content-section[^"]*">(.*?)</section>', main_match.group(2), re.DOTALL))

    section_dict = {}
    for m in sec_matches:
        sec_id = m.group(1)
        sec_body = m.group(2)
        section_dict[sec_id] = sec_body

    target_dir = os.path.dirname(html_path)

    for sec_id in sections:
        # Build individual HTML file
        sec_html = section_dict.get(sec_id)
        if not sec_html:
            # Create basic placeholder if section block not explicitly present
            sec_html = f'''
                <div class="section-header">
                    <h2>{sec_id.title()}</h2>
                </div>
                <div class="card">
                    <div class="table-responsive">
                        <table class="data-table">
                            <tbody id="{sec_id}Body">
                                <tr><td style="text-align:center;">Loading {sec_id}...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            '''

        # Highlight current section in sidebar nav in header_nav
        custom_header = re.sub(
            r'class="sidebar-link active"',
            'class="sidebar-link"',
            header_nav
        )
        custom_header = re.sub(
            f'data-section="{sec_id}" class="sidebar-link"',
            f'data-section="{sec_id}" class="sidebar-link active"',
            custom_header
        )
        # Also ensure section inside <main> has active class
        active_sec_block = f'<section id="sec-{sec_id}" class="content-section active">\n{sec_html}\n</section>'

        page_file_path = os.path.join(target_dir, f"{sec_id}.html")
        full_page_code = f"{custom_header}\n{active_sec_block}\n{footer_scripts}"

        with open(page_file_path, 'w', encoding='utf-8') as pf:
            pf.write(full_page_code)

        print(f"Created dedicated template: {page_file_path}")

# Sections lists
inv_sections = ['overview', 'checkin', 'stocklevels', 'locations', 'stockmovements', 'transfers', 'adjustments', 'counts', 'batches', 'serials', 'reorder', 'reports', 'auditlogs', 'moduleusers']
wh_sections = ['overview', 'zones', 'bins', 'picklists', 'putaway', 'receiving', 'packing', 'shipping', 'auditlogs', 'moduleusers']
mfg_sections = ['overview', 'bom', 'productionorders', 'workcenters', 'routing', 'shopfloor', 'planning', 'capacity', 'reports', 'auditlogs', 'moduleusers']

split_module('inventory', 'templates/inventory/inventory.html', inv_sections)
split_module('warehouse', 'templates/warehouse/warehouse.html', wh_sections)
split_module('manufacturing', 'templates/manufacturing/manufacturing.html', mfg_sections)

print("\n=== All Dedicated Sub-Module HTML Templates Created Successfully! ===")
