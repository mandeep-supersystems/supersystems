import com.healthmarketscience.jackcess.*;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * AccdbBuilder — reads a JSON file produced by sync_accdb.py and writes a .accdb.
 *
 * JSON format:
 * [
 *   {
 *     "acc_table": "Resistor",
 *     "columns":   ["Part Number", "Description", "Value", ...],
 *     "rows":      [["101.0.0001", "Res, 10K ...", "10K", ...], ...]
 *   },
 *   ...
 * ]
 *
 * Usage:
 *   java -jar AccdbBuilder.jar <input.json> <output.accdb>
 */
public class AccdbBuilder {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: AccdbBuilder <input.json> <output.accdb>");
            System.exit(1);
        }

        String jsonPath  = args[0];
        String accdbPath = args[1];

        // Read JSON
        String jsonStr = new String(Files.readAllBytes(Paths.get(jsonPath)), StandardCharsets.UTF_8);
        JSONArray tables = new JSONArray(jsonStr);

        File dbFile = new File(accdbPath);
        if (dbFile.exists()) dbFile.delete();

        Database db = DatabaseBuilder.create(Database.FileFormat.V2010, dbFile);

        for (int t = 0; t < tables.length(); t++) {
            JSONObject tbl      = tables.getJSONObject(t);
            String     accTable = tbl.getString("acc_table");
            JSONArray  cols     = tbl.getJSONArray("columns");
            JSONArray  rows     = tbl.getJSONArray("rows");

            // Build column list — all TEXT, deduplicating names (case-insensitive)
            TableBuilder tb = new TableBuilder(accTable);
            List<String> colNames = new ArrayList<>();
            Set<String> seenCols = new LinkedHashSet<>();
            for (int c = 0; c < cols.length(); c++) {
                String colName = cols.getString(c);
                if (seenCols.add(colName.toLowerCase())) {
                    tb.addColumn(new ColumnBuilder(colName, DataType.MEMO).toColumn());
                    colNames.add(colName);
                }
            }
            Table table = tb.toTable(db);

            for (int r = 0; r < rows.length(); r++) {
                JSONArray row = rows.getJSONArray(r);
                Object[]  vals = new Object[colNames.size()];
                for (int c = 0; c < colNames.size(); c++) {
                    vals[c] = row.isNull(c) ? "" : row.getString(c);
                }
                table.addRow(vals);
            }
        }

        // ── Fixed table: tmpprts (always added, empty, for CAD tool use) ──
        TableBuilder tmpTb = new TableBuilder("tmpprts");
        tmpTb.addColumn(new ColumnBuilder("Tmpprtno",   DataType.MEMO).toColumn());
        tmpTb.addColumn(new ColumnBuilder("Relprtno",   DataType.MEMO).toColumn());
        tmpTb.addColumn(new ColumnBuilder("Username",   DataType.MEMO).toColumn());
        tmpTb.addColumn(new ColumnBuilder("Createtime", DataType.MEMO).toColumn());
        tmpTb.toTable(db);

        db.close();
        System.out.println("OK: " + accdbPath);
    }
}
