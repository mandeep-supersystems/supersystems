"""
sync_accdb.py
─────────────
Builds CadDB.accdb from PostgreSQL part data.

Windows path:
    1. ADOX (win32com.client) — creates blank .accdb and defines table schema
    2. pyodbc                 — inserts all rows via ODBC

Linux path:
    1. Dump all data to a JSON file
    2. Invoke Java + Jackcess (accdb_builder/AccdbBuilder.jar) to write the .accdb

Returns: (bytes, error_string)
    bytes       — raw .accdb file content on success
    error_string — non-empty string on failure
"""

import os
import sys
import re
import json
import tempfile
import subprocess
import platform


# ── helpers ──────────────────────────────────────────────────────────────────

SYSTEM_COLS = {
    'id', 'subcategory_id', 'status', 'created_at', 'updated_at',
    'obsoleted_at', 'obsolete_reason', 'created_by',
    'is_bought_out', 'is_manufactured',
}


def _clean(v):
    """Coerce any value to a clean string for Access (max 255 chars)."""
    if v is None:
        return ''
    s = str(v).strip()
    if s.lower() in ('none', 'null', 'nan'):
        return ''
    return s[:255]


def _acc_table_name(cat_name):
    """Safe Access table name — alphanumeric + underscore, max 60 chars."""
    return re.sub(r'[^A-Za-z0-9_]', '_', cat_name)[:60]


# ── data extraction from PostgreSQL ──────────────────────────────────────────

def _extract_data(db, cats):
    """
    For each category, query its dynamic PG table and the footprints table.
    Returns a list of dicts:
        {
            'acc_table': str,
            'columns':   [str, ...],   # ordered column names for Access
            'rows':      [[str, ...]]  # one list per part row
        }
    """
    from modules.part.routes import _safe_table_name

    tables = []

    for cat in cats:
        cat_name   = cat[1]
        cat_series = cat[2]
        cols_cfg   = cat[4]

        if not isinstance(cols_cfg, list):
            try:
                cols_cfg = json.loads(cols_cfg) if cols_cfg else []
            except Exception:
                cols_cfg = []

        pg_table = _safe_table_name(cat_name, cat_series)

        try:
            result  = db.session.execute(db.text(
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

        # Columns: part_number + description + configured custom cols + footprint cols
        custom = [
            re.sub(r'[^a-z0-9_]', '_', c['name'].lower().strip())
            for c in cols_cfg
        ]
        include = (
            ['part_number', 'description']
            + [c for c in custom if c in pg_cols and c not in SYSTEM_COLS]
            + ['pcb_footprint', 'step_3d_file']
        )

        # Footprint lookup
        pns = [str(r[pg_cols.index('part_number')]) for r in pg_rows]
        fp_lookup = {}
        if pns:
            try:
                ph = ','.join([f':pn{i}' for i in range(len(pns))])
                fp_rows = db.session.execute(db.text(
                    f"SELECT part_number, pcb_footprint, step_3d_file "
                    f"FROM part.parts_footprints WHERE part_number IN ({ph})"
                ), {f'pn{i}': p for i, p in enumerate(pns)}).fetchall()
                for fp in fp_rows:
                    fp_lookup[fp[0]] = (fp[1] or '', fp[2] or '')
            except Exception:
                db.session.rollback()

        rows_out = []
        for row in pg_rows:
            rd = dict(zip(pg_cols, row))
            pn = str(rd.get('part_number', '') or '')
            pcb, step = fp_lookup.get(pn, ('', ''))
            rd['pcb_footprint'] = pcb
            rd['step_3d_file']  = step
            rows_out.append([_clean(rd.get(c)) for c in include])

        tables.append({
            'acc_table': _acc_table_name(cat_name),
            'columns':   include,
            'rows':      rows_out,
        })

    return tables


# ── Windows builder (ADOX + pyodbc) ──────────────────────────────────────────

def _build_windows(tables, accdb_path):
    """
    Step 1 — ADOX: create blank .accdb and define all table schemas.
    Step 2 — pyodbc: insert all rows.
    Returns error string or '' on success.
    """
    try:
        import win32com.client as win32
    except ImportError:
        return "pywin32 not installed. Run: pip install pywin32"

    try:
        import pyodbc
    except ImportError:
        return "pyodbc not installed. Run: pip install pyodbc"

    # ── Step 1: ADOX schema creation ─────────────────────────────────────────
    try:
        cat = win32.Dispatch('ADOX.Catalog')
        cat.Create(f'Provider=Microsoft.ACE.OLEDB.12.0;Data Source={accdb_path};')

        for tbl in tables:
            adox_table = win32.Dispatch('ADOX.Table')
            adox_table.Name = tbl['acc_table']

            for col_name in tbl['columns']:
                col = win32.Dispatch('ADOX.Column')
                col.Name            = col_name
                col.Type            = 202   # adVarWChar (Text)
                col.DefinedSize     = 255
                col.Attributes      = 0x0002  # adColNullable
                adox_table.Columns.Append(col)

            cat.Tables.Append(adox_table)

        # Release COM object
        cat.ActiveConnection = None
        del cat
    except Exception as e:
        return f"ADOX schema creation failed: {e}"

    # ── Step 2: pyodbc row insertion ──────────────────────────────────────────
    try:
        conn_str = (
            r'Driver={Microsoft Access Driver (*.mdb, *.accdb)};'
            f'DBQ={accdb_path};'
        )
        conn = pyodbc.connect(conn_str, autocommit=True)
        cur  = conn.cursor()

        for tbl in tables:
            cols_sql = ', '.join(f'[{c}]' for c in tbl['columns'])
            ph_sql   = ', '.join('?' for _ in tbl['columns'])
            sql      = f"INSERT INTO [{tbl['acc_table']}] ({cols_sql}) VALUES ({ph_sql})"
            for row in tbl['rows']:
                try:
                    cur.execute(sql, row)
                except Exception:
                    pass  # skip individual bad rows

        conn.commit()
        conn.close()
    except Exception as e:
        return f"pyodbc insert failed: {e}"

    return ''


# ── Linux builder (JSON → Java + Jackcess) ───────────────────────────────────

def _build_linux(tables, accdb_path):
    """
    Dump data to a temp JSON file, then call:
        java -jar accdb_builder/AccdbBuilder.jar <json_path> <accdb_path>
    Returns error string or '' on success.
    """
    jar_path = os.path.join(
        os.path.dirname(__file__), '..', '..', 'accdb_builder', 'AccdbBuilder.jar'
    )
    jar_path = os.path.abspath(jar_path)

    if not os.path.exists(jar_path):
        return (
            f"AccdbBuilder.jar not found at {jar_path}. "
            "Run: cd accdb_builder && bash setup.sh"
        )

    tmp_json = tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8')
    try:
        json.dump(tables, tmp_json, ensure_ascii=False)
        tmp_json.close()

        java_bin = subprocess.run(['which', 'java'], capture_output=True, text=True).stdout.strip() or 'java'
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


# ── public entry point ────────────────────────────────────────────────────────

def sync_accdb(db):
    """
    Build CadDB.accdb from PostgreSQL.

    Args:
        db: Flask-SQLAlchemy db instance

    Returns:
        (bytes, error_str)
        On success: (file_bytes, '')
        On failure: (None, 'error message')
    """
    # Fetch all categories
    cats = db.session.execute(db.text(
        "SELECT id, name, series_prefix, COALESCE(code, name), columns_config "
        "FROM part.categories WHERE is_deleted = false ORDER BY name"
    )).fetchall()

    tables = _extract_data(db, cats)

    if not tables:
        return None, "No part data found to export"

    tmp = tempfile.NamedTemporaryFile(suffix='.accdb', delete=False)
    tmp.close()
    accdb_path = tmp.name

    try:
        is_windows = platform.system() == 'Windows'

        if is_windows:
            err = _build_windows(tables, accdb_path)
        else:
            err = _build_linux(tables, accdb_path)

        if err:
            return None, err

        with open(accdb_path, 'rb') as f:
            data = f.read()

        return data, ''

    finally:
        try:
            os.unlink(accdb_path)
        except Exception:
            pass
