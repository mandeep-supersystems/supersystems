"""
sync_accdb.py
─────────────
Builds CadDB.accdb from PostgreSQL part data and saves it as a persistent file.

- sync_accdb(db)      → rebuilds the file from scratch, returns (bytes, error_str)
- get_accdb_bytes()   → returns (bytes, error_str) from the existing file without rebuilding

Linux path:
    1. Dump all data to a JSON file
    2. Invoke Java + Jackcess (accdb_builder/AccdbBuilder.jar) to write the .accdb

Windows path:
    1. ADOX (win32com.client) — creates blank .accdb and defines table schema
    2. pyodbc                 — inserts all rows via ODBC
"""

import os
import re
import json
import tempfile
import subprocess
import platform

# ── persistent file path ──────────────────────────────────────────────────────

_ACCDB_PATH = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', 'CadDB.accdb'
))

# ── hardcoded category tables ─────────────────────────────────────────────────
# Maps PostgreSQL table suffix (part."<name>_<series>") → Access table display name
# Key = category name as stored in part.categories.name (exact match, case-insensitive)
# Value = display name shown in the .accdb file

CATEGORY_TABLES = {
    'Resistor':           'Resistor',
    'Capacitor':          'Capacitor',
    'Diode':              'Diode',
    'Transistor':         'Transistor',
    'Mosfet':             'Mosfet',
    'IC':                 'Ic',
    'Inductor':           'Inductor',
    'Transformer':        'Transformer',
    'Connector':          'Connector',
    'Header':             'Header',
    'Terminal':           'Terminal',
    'Relay':              'Relay',
    'Switch':             'Switch',
    'LED':                'Led',
    'Sensor':             'Sensor',
    'Buzzer':             'Buzzer',
    'Heat Sink':          'Heat Sink',
    'Screw':              'Screw',
    'Washers':            'Washers',
    'Thermals':           'Thermals',
    'Stickers':           'Stickers',
    'Bare PCB':           'Bare Pcb',
    'Non BOM':            'Non Bom',
    'Protection':         'Protection',
    'LCD Module':         'Lcd Module',
    'Mechanical':         'Mechanical',
    'Thermal Pad':        'Thermal Pad',
    'Fan':                'Fan',
    'Crimping Pin':       'Crimping Pin',
    'Cable':              'Cable',
    'MCB':                'Mcb',
    'SPD':                'Spd',
    'Chemicals':          'Chemicals',
    'Power IC':           'Power Ic',
    'Assembly':           'Assembly',
}

# ── CIS Manufacturer Parts — fixed schema ─────────────────────────────────────

_CIS_ACC_TABLE = 'Cis Manufacturer Parts'
assert ' ' in _CIS_ACC_TABLE, "CIS table name must use spaces not underscores"
_CIS_ACCDB_COLS = [
    'Part Number', 'Manufacturer', 'Manufacturer PN',
    'Manufacturer PN Status', 'Datasheet',
]

# ── system columns to skip ────────────────────────────────────────────────────

SYSTEM_COLS = {
    'id', 'subcategory_id', 'status', 'created_at', 'updated_at',
    'obsoleted_at', 'obsolete_reason', 'created_by',
    'is_bought_out', 'is_manufactured',
}

COLUMN_RENAMES = {
    'mounting_type':  'Part Type',
    'connector_type': 'Part Type',
    'antenna_type':   'Part Type',
    'bobbin_type':    'Part Type',
    'core_type':      'Part Type',
    'adhesive_type':  'Part Type',
    'type':           'Part Type',
    'schematic_part': 'Schematic Part',
    'pcb_footprint':  'PCB Footprint',
    'step_3d_file':   '3D Step File',
}

# ── helpers ───────────────────────────────────────────────────────────────────

def _clean(v):
    if v is None:
        return ''
    s = str(v).strip()
    if s.lower() in ('none', 'null', 'nan'):
        return ''
    return s[:255]


def _col_label(col):
    if col == 'part_number':
        return 'Part Number'
    return COLUMN_RENAMES.get(col, col.replace('_', ' ').title())


# ── data extraction ───────────────────────────────────────────────────────────

def _extract_data(db, cats):
    from modules.part.routes import _safe_table_name

    tables = []
    seen_acc = set()  # acc display names already used (lowercase)
    seen_acc.add(_CIS_ACC_TABLE.lower())  # reserve CIS table name
    seen_acc.add('cis_manufacturer_parts')  # reserve raw DB table name

    # Build lookup: lowercase cat name → accdb display name
    cat_map_lower = {k.lower(): v for k, v in CATEGORY_TABLES.items()}

    for cat in cats:
        cat_name   = cat[1]
        cat_series = cat[2]
        cols_cfg   = cat[4]

        # Only export categories in the hardcoded list
        if cat_name.lower().replace(' ', '_') == 'cis_manufacturer_parts':
            continue
        acc_table = cat_map_lower.get(cat_name.lower())
        if not acc_table:
            continue
        if acc_table.lower() in seen_acc:
            continue
        seen_acc.add(acc_table.lower())

        if not isinstance(cols_cfg, list):
            try:
                cols_cfg = json.loads(cols_cfg) if cols_cfg else []
            except Exception:
                cols_cfg = []

        pg_table = _safe_table_name(cat_name, cat_series)

        # Ensure configured columns exist physically
        type_map = {
            'varchar': 'VARCHAR(255)', 'numeric': 'NUMERIC(14,4)',
            'boolean': 'BOOLEAN', 'date': 'DATE', 'text': 'TEXT',
        }
        for col in cols_cfg:
            cname = re.sub(r'[^a-z0-9_]', '_', col['name'].lower().strip())
            if not cname or cname in SYSTEM_COLS:
                continue
            ctype = type_map.get(col.get('type', 'varchar'), 'VARCHAR(255)')
            try:
                db.session.execute(db.text(
                    f'ALTER TABLE {pg_table} ADD COLUMN IF NOT EXISTS "{cname}" {ctype}'
                ))
                db.session.commit()
            except Exception:
                db.session.rollback()

        try:
            result = db.session.execute(db.text(
                f"SELECT * FROM {pg_table} "
                f"WHERE (status IS NULL OR status != 'obsolete') "
                f"ORDER BY part_number"
            ))
            pg_cols = list(result.keys())
            pg_rows = result.fetchall()
        except Exception:
            db.session.rollback()
            continue

        if not pg_rows:
            continue

        # Build column list
        custom = [re.sub(r'[^a-z0-9_]', '_', c['name'].lower().strip()) for c in cols_cfg]
        seen = {'part_number', 'description'}
        custom_cols = [c for c in custom if c in pg_cols and c not in SYSTEM_COLS and c not in seen and not seen.add(c)]

        has_sch = 'schematic_part' in pg_cols
        fp_cols = (['schematic_part'] if has_sch else []) + ['pcb_footprint', 'step_3d_file']

        # Footprint lookup
        pns = [str(r[pg_cols.index('part_number')]) for r in pg_rows]
        fp_lookup = {}
        if pns:
            try:
                ph = ','.join([f':pn{i}' for i in range(len(pns))])
                fp_rows_db = db.session.execute(db.text(
                    f"SELECT part_number, pcb_footprint, step_3d_file "
                    f"FROM part.parts_footprints WHERE part_number IN ({ph})"
                ), {f'pn{i}': p for i, p in enumerate(pns)}).fetchall()
                for fp in fp_rows_db:
                    fp_lookup[fp[0]] = (fp[1] or '', fp[2] or '')
            except Exception:
                db.session.rollback()

        # Deduplicate include list
        _seen_inc = set()
        include = []
        for c in ['part_number', 'description'] + custom_cols + fp_cols:
            if c not in _seen_inc:
                _seen_inc.add(c)
                include.append(c)

        # Deduplicate display names
        _seen_disp = set()
        include_final = []
        include_display = []
        for c in include:
            d = _col_label(c)
            if d not in _seen_disp:
                _seen_disp.add(d)
                include_final.append(c)
                include_display.append(d)
        include = include_final

        rows_out = []
        for row in pg_rows:
            rd = dict(zip(pg_cols, row))
            pn = str(rd.get('part_number', '') or '')
            pcb, step = fp_lookup.get(pn, ('', ''))
            rd['pcb_footprint'] = pcb
            rd['step_3d_file']  = step
            rows_out.append([_clean(rd.get(c)) for c in include])

        tables.append({
            'acc_table': acc_table,
            'columns':   include_display,
            'rows':      rows_out,
        })

    return tables


def _extract_cis_manufacturer_parts(db):
    # Ensure columns exist
    try:
        db.session.execute(db.text(
            "ALTER TABLE part.manufacturers "
            "ADD COLUMN IF NOT EXISTS mpn_status TEXT DEFAULT 'Active', "
            "ADD COLUMN IF NOT EXISTS datasheet TEXT DEFAULT ''"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()

    # Ensure table exists
    try:
        db.session.execute(db.text("""
            CREATE TABLE IF NOT EXISTS part.cis_manufacturer_parts (
                id                     SERIAL PRIMARY KEY,
                part_number            VARCHAR(100) NOT NULL,
                manufacturer           VARCHAR(255) DEFAULT '',
                manufacturer_pn        VARCHAR(255) DEFAULT '',
                manufacturer_pn_status VARCHAR(100) DEFAULT '',
                datasheet              TEXT DEFAULT '',
                created_at             TIMESTAMP DEFAULT NOW(),
                updated_at             TIMESTAMP DEFAULT NOW()
            )
        """))
        db.session.execute(db.text(
            "CREATE INDEX IF NOT EXISTS idx_cis_mfr_parts_pn "
            "ON part.cis_manufacturer_parts(part_number)"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()

    # Full refresh
    try:
        db.session.execute(db.text("TRUNCATE part.cis_manufacturer_parts RESTART IDENTITY"))
        db.session.execute(db.text("""
            INSERT INTO part.cis_manufacturer_parts
                (part_number, manufacturer, manufacturer_pn, manufacturer_pn_status, datasheet)
            SELECT
                m.part_number,
                COALESCE(m.make, ''),
                COALESCE(m.mpn, ''),
                COALESCE(m.mpn_status, ''),
                COALESCE(m.datasheet, '')
            FROM part.manufacturers m
            WHERE (m.mpn IS NOT NULL AND m.mpn != '')
               OR (m.make IS NOT NULL AND m.make != '')
            ORDER BY m.part_number, m.mpn
        """))
        db.session.commit()
    except Exception:
        db.session.rollback()

    try:
        rows = db.session.execute(db.text(
            "SELECT part_number, manufacturer, manufacturer_pn, "
            "manufacturer_pn_status, datasheet "
            "FROM part.cis_manufacturer_parts "
            "ORDER BY part_number, manufacturer_pn"
        )).fetchall()
    except Exception:
        db.session.rollback()
        return None

    if not rows:
        return None

    return {
        'acc_table': 'Cis Manufacturer Parts',  # hardcoded — never use variable
        'columns':   _CIS_ACCDB_COLS,
        'rows': [
            [_clean(r[0]), _clean(r[1]), _clean(r[2]), _clean(r[3]), _clean(r[4])]
            for r in rows
        ],
    }


# ── builders ──────────────────────────────────────────────────────────────────

def _build_windows(tables, accdb_path):
    try:
        import win32com.client as win32
    except ImportError:
        return "pywin32 not installed. Run: pip install pywin32"
    try:
        import pyodbc
    except ImportError:
        return "pyodbc not installed. Run: pip install pyodbc"

    if os.path.exists(accdb_path):
        os.remove(accdb_path)

    try:
        cat = win32.Dispatch('ADOX.Catalog')
        cat.Create(f'Provider=Microsoft.ACE.OLEDB.12.0;Data Source={accdb_path};')

        for tbl in tables:
            adox_table = win32.Dispatch('ADOX.Table')
            adox_table.Name = tbl['acc_table']
            for col_name in tbl['columns']:
                col = win32.Dispatch('ADOX.Column')
                col.Name        = col_name
                col.Type        = 202   # adVarWChar
                col.DefinedSize = 255
                col.Attributes  = 0x0002  # adColNullable
                adox_table.Columns.Append(col)
            cat.Tables.Append(adox_table)

        cat = None
    except Exception as e:
        return f"ADOX schema creation failed: {e}"

    try:
        conn = pyodbc.connect(
            r'Driver={Microsoft Access Driver (*.mdb, *.accdb)};' + f'DBQ={accdb_path};',
            autocommit=True
        )
        cur = conn.cursor()
        for tbl in tables:
            cols_sql = ', '.join(f'[{c}]' for c in tbl['columns'])
            ph_sql   = ', '.join('?' for _ in tbl['columns'])
            sql      = f"INSERT INTO [{tbl['acc_table']}] ({cols_sql}) VALUES ({ph_sql})"
            for row in tbl['rows']:
                try:
                    cur.execute(sql, row)
                except Exception:
                    pass
        conn.commit()
        conn.close()
    except Exception as e:
        return f"pyodbc insert failed: {e}"

    return ''


def _build_linux(tables, accdb_path):
    jar_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__), '..', '..', 'accdb_builder', 'AccdbBuilder.jar'
    ))
    if not os.path.exists(jar_path):
        return f"AccdbBuilder.jar not found at {jar_path}. Run: cd accdb_builder && bash setup.sh"

    tmp_json = tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8')
    try:
        json.dump(tables, tmp_json, ensure_ascii=False)
        tmp_json.close()

        import shutil

        def _find_java():
            candidate = shutil.which('java')
            if candidate:
                try:
                    if subprocess.run([candidate, '-version'], capture_output=True, timeout=10).returncode == 0:
                        return candidate
                except Exception:
                    pass
            for path in [
                '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
                '/usr/lib/jvm/openjdk-21/bin/java',
                '/usr/lib/jvm/default-java/bin/java',
                '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
                '/usr/lib/jvm/java-11-openjdk-amd64/bin/java',
                '/usr/bin/java',
            ]:
                if os.path.isfile(path):
                    try:
                        if subprocess.run([path, '-version'], capture_output=True, timeout=10).returncode == 0:
                            return path
                    except Exception:
                        continue
            return None

        java_bin = _find_java()
        if not java_bin:
            return "Java is not installed. Run: sudo apt-get install -y default-jre"

        result = subprocess.run(
            [java_bin, '-jar', jar_path, tmp_json.name, accdb_path],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return f"Java builder failed:\n{result.stderr or result.stdout}"
    except subprocess.TimeoutExpired:
        return "Java builder timed out (>120s)"
    except Exception as e:
        return f"Java builder error: {e}"
    finally:
        try:
            os.unlink(tmp_json.name)
        except Exception:
            pass

    return ''


# ── public API ────────────────────────────────────────────────────────────────

def sync_accdb(db):
    """
    Rebuild CadDB.accdb from PostgreSQL and save to disk.
    Returns (bytes, error_str).
    """
    cats = db.session.execute(db.text(
        "SELECT id, name, series_prefix, COALESCE(code, name), columns_config "
        "FROM part.categories WHERE is_deleted = false ORDER BY name"
    )).fetchall()

    tables = _extract_data(db, cats)

    cis_table = _extract_cis_manufacturer_parts(db)
    if cis_table:
        tables.append(cis_table)

    if not tables:
        return None, "No part data found to export"

    accdb_path = _ACCDB_PATH

    if platform.system() == 'Windows':
        err = _build_windows(tables, accdb_path)
    else:
        print(f"[sync_accdb] tables to write: {[t['acc_table'] for t in tables]}", flush=True)
        err = _build_linux(tables, accdb_path)

    if err:
        return None, err

    with open(accdb_path, 'rb') as f:
        return f.read(), ''


def get_accdb_bytes():
    """
    Return the existing CadDB.accdb from disk without rebuilding.
    Returns (bytes, error_str).
    """
    if not os.path.exists(_ACCDB_PATH):
        return None, "CadDB.accdb not found. Please sync first."
    with open(_ACCDB_PATH, 'rb') as f:
        return f.read(), ''
